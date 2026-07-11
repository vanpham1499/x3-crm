<?php

namespace App\Services;

use App\Http\Resources\RevenueResource;
use App\Models\Revenue;
use App\Repositories\RevenueRepository;
use Illuminate\Support\Facades\DB;

class RevenuesService extends BaseService
{
    public function __construct(private readonly RevenueRepository $revenues) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->revenues->findAll($this->normalizeKeys($filters)), RevenueResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->revenues->findWithRelationsOrFail($id), RevenueResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $items = $data['items'] ?? [];
            unset($data['items']);

            $data = $this->normalizePayload($data);
            $items = $this->normalizeItems($items);
            $data = $this->applyItemTotals($data, $items);
            $data['payment_status'] = $data['payment_status'] ?? Revenue::PAYMENT_STATUS_UNPAID;
            $data['invoice_status'] = $data['invoice_status'] ?? Revenue::INVOICE_STATUS_NOT_ISSUED;
            $data['revenue_code'] = $data['revenue_code'] ?? $this->generateRevenueCode($data);

            /** @var Revenue $revenue */
            $revenue = $this->revenues->create($data);
            $this->syncItems($revenue, $items);

            return $this->apiResource($revenue->load(['project.customer', 'items.service']), RevenueResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $hasItems = array_key_exists('items', $data);
            $items = $data['items'] ?? [];
            unset($data['items']);

            $data = $this->normalizePayload($data);
            $items = $this->normalizeItems($items);
            $data = $hasItems ? $this->applyItemTotals($data, $items) : $data;

            /** @var Revenue $revenue */
            $revenue = $this->revenues->update($id, $data);

            if ($hasItems) {
                $this->syncItems($revenue, $items);
            }

            return $this->apiResource($revenue->load(['project.customer', 'items.service']), RevenueResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->revenues->delete($id);

            return ['message' => 'Xóa doanh thu thành công'];
        });
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        foreach (['project_id'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'projectId' => 'project_id',
            'revenueCode' => 'revenue_code',
            'revenueType' => 'revenue_type',
            'reportedDate' => 'reported_date',
            'paymentDueDate' => 'payment_due_date',
            'paidDate' => 'paid_date',
            'revenueMonth' => 'revenue_month',
            'amountBeforeVat' => 'amount_before_vat',
            'vatRate' => 'vat_rate',
            'vatAmount' => 'vat_amount',
            'amountAfterVat' => 'amount_after_vat',
            'actualReceivedAmount' => 'actual_received_amount',
            'paymentStatus' => 'payment_status',
            'invoiceStatus' => 'invoice_status',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function normalizeItems(array $items): array
    {
        return collect($items)
            ->map(function (array $item): array {
                $item = $this->normalizeItemKeys($item);
                $item = $this->applyItemServiceDefaults($item);

                $quantity = (float) ($item['quantity'] ?? 1);
                $unitPrice = (float) ($item['unit_price'] ?? 0);
                $amount = (float) ($item['amount'] ?? round($quantity * $unitPrice, 2));

                return array_merge($item, [
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'amount' => $amount,
                ]);
            })
            ->values()
            ->all();
    }

    private function normalizeItemKeys(array $item): array
    {
        $map = [
            'serviceId' => 'service_id',
            'servicePackageId' => 'service_package_id',
            'itemName' => 'item_name',
            'unitPrice' => 'unit_price',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $item)) {
                $item[$to] = $item[$from];
                unset($item[$from]);
            }
        }

        return $item;
    }

    private function applyItemServiceDefaults(array $item): array
    {
        if (! empty($item['service_id'])) {
            $service = DB::table('services')->where('id', $item['service_id'])->whereNull('deleted_at')->first();

            if ($service) {
                $item['item_name'] = $item['item_name'] ?? $service->name;
                $item['unit'] = $item['unit'] ?? $service->unit;
            }
        }

        return $item;
    }

    private function applyItemTotals(array $data, array $items): array
    {
        if ($items === []) {
            return $data;
        }

        $subtotal = collect($items)->sum(fn (array $item): float => (float) $item['amount']);
        $vatRate = (float) ($data['vat_rate'] ?? 0);
        $vatAmount = round($subtotal * $vatRate / 100, 2);

        $data['amount_before_vat'] = round($subtotal, 2);
        $data['vat_amount'] = $data['vat_amount'] ?? $vatAmount;
        $data['amount_after_vat'] = $data['amount_after_vat'] ?? round($subtotal + $data['vat_amount'], 2);
        $data['actual_received_amount'] = $data['actual_received_amount'] ?? $data['amount_after_vat'];

        return $data;
    }

    private function syncItems(Revenue $revenue, array $items): void
    {
        $revenue->items()->delete();

        foreach ($items as $item) {
            $revenue->items()->create($item);
        }
    }

    private function generateRevenueCode(array $data): string
    {
        $projectCode = DB::table('projects')->where('id', $data['project_id'] ?? null)->value('project_code') ?: 'DT';
        $baseCode = preg_replace('/[^A-Za-z0-9._-]/', '', $projectCode) ?: 'DT';

        $nextNumber = ((int) DB::table('revenues')
            ->where('revenue_code', 'like', $baseCode.'.DT%')
            ->whereRaw("revenue_code ~ ?", ['^'.preg_quote($baseCode, '/').'\\.DT[0-9]+$'])
            ->selectRaw("MAX(CAST(SUBSTRING(revenue_code FROM '\\.DT([0-9]+)$') AS INTEGER)) as max_number")
            ->value('max_number')) + 1;

        do {
            $code = sprintf('%s.DT%03d', $baseCode, $nextNumber);
            $nextNumber++;
        } while (DB::table('revenues')->where('revenue_code', $code)->exists());

        return $code;
    }
}
