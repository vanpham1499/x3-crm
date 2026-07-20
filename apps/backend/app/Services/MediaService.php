<?php

namespace App\Services;

use App\Http\Resources\AttachmentResource;
use App\Models\Attachment;
use App\Models\Customer;
use App\Models\Quotation;
use App\Models\User;
use App\Models\WeeklyReportAttachment;
use App\Support\FileUploadStorage;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class MediaService extends BaseService
{
    public function findAll(User $user, string $scope = 'mine', ?string $keyword = null)
    {
        $images = $this->imageQuery($user, $scope, $keyword)
            ->limit(80)
            ->get();

        $this->attachUsageMetadata($images);

        return $this->apiCollection($images, AttachmentResource::class);
    }

    public function findPaginated(
        User $user,
        string $scope,
        ?string $keyword,
        int $perPage,
        int $page,
    ): array {
        $paginator = $this->imageQuery($user, $scope, $keyword)
            ->paginate($perPage, ['*'], 'page', $page);

        $this->attachUsageMetadata($paginator->getCollection());

        return $this->apiPaginatedCollection($paginator, AttachmentResource::class);
    }

    private function imageQuery(User $user, string $scope, ?string $keyword): Builder
    {
        $keyword = trim((string) $keyword);

        return Attachment::query()
            ->with('uploadedBy:id,name')
            ->where('entity_type', 'media_library')
            ->where('file_type', 'like', 'image/%')
            ->when($scope !== 'all' || $user->role !== User::ROLE_ADMIN, fn ($query) => $query->where('uploaded_by', $user->id))
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query->where('file_name', 'ilike', "%{$keyword}%");

                    if (Schema::hasColumn('attachments', 'original_name')) {
                        $query->orWhere('original_name', 'ilike', "%{$keyword}%");
                    }
                });
            })
            ->latest();
    }

    public function upload(UploadedFile $file, User $user, ?string $name = null): array
    {
        return $this->transaction(function () use ($file, $user, $name): array {
            $stored = FileUploadStorage::store($file, 'media');

            $payload = [
                'entity_type' => 'media_library',
                'entity_id' => $user->id,
                'file_name' => $stored['fileName'],
                'file_url' => $stored['fileUrl'],
                'file_type' => $stored['mimeType'],
                'uploaded_by' => $user->id,
                'created_by' => $user->id,
            ];

            if (Schema::hasColumn('attachments', 'original_name')) {
                $payload['original_name'] = trim((string) $name) ?: $stored['originalName'];
            }

            if (Schema::hasColumn('attachments', 'mime_type')) {
                $payload['mime_type'] = $stored['mimeType'];
            }

            if (Schema::hasColumn('attachments', 'file_size')) {
                $payload['file_size'] = $stored['fileSize'];
            }

            if (Schema::hasColumn('attachments', 'disk')) {
                $payload['disk'] = 'public';
            }

            /** @var Attachment $attachment */
            $attachment = Attachment::query()->create($payload);
            $attachment->load('uploadedBy:id,name');
            $attachment->setRelation('mediaUsages', collect());

            return $this->apiResource($attachment, AttachmentResource::class);
        });
    }

    public function update(string $id, array $data, User $user): array
    {
        return $this->transaction(function () use ($id, $data, $user): array {
            $attachment = $this->findAccessibleImage($id, $user);
            $attachment->original_name = trim((string) $data['name']);
            $attachment->save();
            $attachment->load('uploadedBy:id,name');
            $this->attachUsageMetadata(collect([$attachment]));

            return $this->apiResource($attachment, AttachmentResource::class);
        });
    }

    public function remove(string $id, User $user, bool $detachUsage = false): array
    {
        return $this->transaction(function () use ($id, $user, $detachUsage): array {
            $attachment = $this->findAccessibleImage($id, $user);
            $this->attachUsageMetadata(collect([$attachment]));
            $usages = $attachment->getRelation('mediaUsages')?->all() ?? [];

            if ($usages !== [] && ! $detachUsage) {
                $sources = collect($usages)
                    ->pluck('typeLabel')
                    ->unique()
                    ->implode(', ');

                throw new ConflictHttpException("Không thể xóa ảnh đang được sử dụng tại: {$sources}.");
            }

            if ($usages !== []) {
                $this->detachImageUsages($attachment->file_url, $user);
            }

            $attachment->deleted_by = $user->id;
            $attachment->save();
            $attachment->delete();
            FileUploadStorage::delete($attachment->file_url);

            return ['message' => 'Xóa ảnh thành công'];
        });
    }

    private function detachImageUsages(string $url, User $user): void
    {
        if (Schema::hasColumn('customers', 'identity_image_urls')) {
            Customer::query()
                ->whereJsonContains('identity_image_urls', $url)
                ->get()
                ->each(function (Customer $customer) use ($url): void {
                    $customer->identity_image_urls = array_values(array_filter(
                        $customer->identity_image_urls ?? [],
                        fn (string $imageUrl): bool => $imageUrl !== $url,
                    ));
                    $customer->save();
                });
        }

        if (Schema::hasColumn('quotations', 'account_reconciliation_image_urls')) {
            Quotation::query()
                ->whereJsonContains('account_reconciliation_image_urls', $url)
                ->get()
                ->each(function (Quotation $quotation) use ($url): void {
                    $quotation->account_reconciliation_image_urls = array_values(array_filter(
                        $quotation->account_reconciliation_image_urls ?? [],
                        fn (string $imageUrl): bool => $imageUrl !== $url,
                    ));
                    $quotation->save();
                });
        }

        if (Schema::hasTable('weekly_report_attachments')) {
            WeeklyReportAttachment::query()
                ->where('file_url', $url)
                ->get()
                ->each(function (WeeklyReportAttachment $reportAttachment) use ($user): void {
                    $reportAttachment->deleted_by = $user->id;
                    $reportAttachment->save();
                    $reportAttachment->delete();
                });
        }

        User::query()
            ->where('avatar', $url)
            ->get()
            ->each(function (User $profileUser) use ($user): void {
                $profileUser->avatar = null;
                $profileUser->updated_by = $user->id;
                $profileUser->save();
            });
    }

    private function findAccessibleImage(string $id, User $user): Attachment
    {
        /** @var Attachment $attachment */
        $attachment = Attachment::query()
            ->where('entity_type', 'media_library')
            ->where('file_type', 'like', 'image/%')
            ->findOrFail($id);

        if ($user->role !== User::ROLE_ADMIN && (int) $attachment->uploaded_by !== (int) $user->id) {
            throw new AuthorizationException('Bạn không có quyền quản lý ảnh này.');
        }

        return $attachment;
    }

    private function attachUsageMetadata(Collection $images): void
    {
        $urls = $images->pluck('file_url')->filter()->unique()->values();

        if ($urls->isEmpty()) {
            return;
        }

        $usageMap = $urls->mapWithKeys(fn (string $url): array => [$url => []])->all();
        $appendUsage = function (string $url, array $usage) use (&$usageMap): void {
            if (! array_key_exists($url, $usageMap)) {
                return;
            }

            $key = $usage['type'].':'.$usage['entityId'];
            $existingKeys = collect($usageMap[$url])
                ->map(fn (array $item): string => $item['type'].':'.$item['entityId']);

            if (! $existingKeys->contains($key)) {
                $usageMap[$url][] = $usage;
            }
        };

        if (Schema::hasColumn('customers', 'identity_image_urls')) {
            $customers = Customer::query()
                ->select(['id', 'customer_code', 'customer_name', 'identity_image_urls'])
                ->where(function ($query) use ($urls): void {
                    foreach ($urls as $url) {
                        $query->orWhereJsonContains('identity_image_urls', $url);
                    }
                })
                ->get();

            foreach ($customers as $customer) {
                foreach ($customer->identity_image_urls ?? [] as $url) {
                    $appendUsage($url, [
                        'type' => 'customer',
                        'typeLabel' => 'Khách hàng',
                        'entityId' => $customer->id,
                        'label' => trim($customer->customer_code.'.'.$customer->customer_name, '.'),
                        'href' => "/customers/{$customer->id}",
                    ]);
                }
            }
        }

        if (Schema::hasColumn('quotations', 'account_reconciliation_image_urls')) {
            $quotations = Quotation::query()
                ->select(['id', 'quotation_code', 'account_reconciliation_image_urls'])
                ->where(function ($query) use ($urls): void {
                    foreach ($urls as $url) {
                        $query->orWhereJsonContains('account_reconciliation_image_urls', $url);
                    }
                })
                ->get();

            foreach ($quotations as $quotation) {
                foreach ($quotation->account_reconciliation_image_urls ?? [] as $url) {
                    $appendUsage($url, [
                        'type' => 'quotation',
                        'typeLabel' => 'Báo phí',
                        'entityId' => $quotation->id,
                        'label' => $quotation->quotation_code ?: "Báo phí #{$quotation->id}",
                        'href' => "/quotations/{$quotation->id}",
                    ]);
                }
            }
        }

        if (Schema::hasTable('weekly_report_attachments')) {
            $reportAttachments = WeeklyReportAttachment::query()
                ->with('weeklyReport.project:id,project_code')
                ->whereIn('file_url', $urls)
                ->get();

            foreach ($reportAttachments as $reportAttachment) {
                $report = $reportAttachment->weeklyReport;

                if (! $report) {
                    continue;
                }

                $week = $report->week_start_date?->format('d/m/Y');
                $projectCode = $report->project?->project_code;
                $label = collect([$projectCode, $week ? "Tuần {$week}" : null])
                    ->filter()
                    ->implode(' · ');

                $appendUsage($reportAttachment->file_url, [
                    'type' => 'weekly_report',
                    'typeLabel' => 'Báo cáo tuần',
                    'entityId' => $report->id,
                    'label' => $label ?: "Báo cáo #{$report->id}",
                    'href' => "/weekly-reports/{$report->id}",
                ]);
            }
        }

        $users = User::query()
            ->select(['id', 'code', 'name', 'avatar'])
            ->whereIn('avatar', $urls)
            ->get();

        foreach ($users as $profileUser) {
            $appendUsage($profileUser->avatar, [
                'type' => 'user',
                'typeLabel' => 'Nhân viên',
                'entityId' => $profileUser->id,
                'label' => collect([$profileUser->code, $profileUser->name])->filter()->implode(' · '),
                'href' => "/users/{$profileUser->id}",
            ]);
        }

        foreach ($images as $image) {
            $image->setRelation('mediaUsages', collect($usageMap[$image->file_url] ?? []));
        }
    }
}
