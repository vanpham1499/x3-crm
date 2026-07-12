<?php

namespace App\Services;

use App\Http\Resources\QuotationResource;
use App\Models\Quotation;
use App\Repositories\PaymentRepository;
use App\Repositories\QuotationRepository;
use App\Support\QuotationReference;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class QuotationsService extends BaseService
{
    public function __construct(
        private readonly QuotationRepository $quotations,
        private readonly PaymentRepository $payments,
    ) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->quotations->findAll($this->normalizeKeys($filters)), QuotationResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->quotations->findWithRelationsOrFail($id), QuotationResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $items = $data['items'] ?? [];
            unset($data['items']);

            $data = $this->normalizePayload($data);
            $items = $this->normalizeItems($items);
            $data = $this->applyItemTotals($data, $items);
            $data = $this->applyServiceDefaults($data);
            $data['quotation_code'] = $data['quotation_code'] ?? $this->generateQuotationCode($data);
            $data['status'] = $data['status'] ?? Quotation::STATUS_DRAFT;

            /** @var Quotation $quotation */
            $quotation = $this->quotations->create($data);
            $this->syncItems($quotation, $items);

            return $this->apiResource($quotation->load(['lead', 'customer', 'project', 'contract', 'service', 'items.service']), QuotationResource::class);
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
            $data = $this->applyServiceDefaults($data);

            /** @var Quotation $quotation */
            $quotation = $this->quotations->update($id, $data);
            if ($hasItems) {
                $this->syncItems($quotation, $items);
            }

            return $this->apiResource($quotation->load(['lead', 'customer', 'project', 'contract', 'service', 'items.service']), QuotationResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->quotations->delete($id);

            return ['message' => 'Xóa quotation thành công'];
        });
    }

    public function linkWonRecords(string $quotationId, string $customerId, string $projectId, ?string $contractId = null): Quotation
    {
        /** @var Quotation $quotation */
        $quotation = $this->quotations->update($quotationId, [
            'customer_id' => $customerId,
            'project_id' => $projectId,
            'contract_id' => $contractId,
            'status' => Quotation::STATUS_WON,
        ]);

        $receivedAmount = (float) DB::table('payments')
            ->where('quotation_id', $quotationId)
            ->whereNull('deleted_at')
            ->sum('amount');
        $paymentStatus = $this->paymentCollectionStatus(
            $receivedAmount,
            (float) $quotation->total_amount,
            'matched_project',
        );

        DB::table('payments')
            ->where('quotation_id', $quotationId)
            ->whereNull('deleted_at')
            ->update([
                'customer_id' => $customerId,
                'project_id' => $projectId,
                'contract_id' => $contractId,
                'status' => $paymentStatus,
                'reconciled_status' => 'matched_project',
                'matched_at' => now(),
                'updated_at' => now(),
            ]);

        return $quotation->load(['lead', 'customer', 'project', 'contract', 'service']);
    }

    public function findModel(string $id): Quotation
    {
        return $this->quotations->findWithRelationsOrFail($id);
    }

    public function findByCode(?string $code): ?Quotation
    {
        return $this->quotations->findByCode($code);
    }

    public function findCodeInText(string $text): ?Quotation
    {
        $codes = $this->quotations->findAll([])
            ->pluck('quotation_code')
            ->filter(fn (?string $code): bool => $code !== null && $code !== '')
            ->sortByDesc(fn (string $code): int => strlen($code));

        foreach ($codes as $code) {
            if (QuotationReference::appearsIn($text, $code)) {
                return $this->quotations->findByCode($code);
            }
        }

        return null;
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        foreach (['customer_id', 'project_id', 'contract_id', 'service_id'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        $subtotal = (float) ($data['subtotal_amount'] ?? 0);
        $vatRate = (float) ($data['vat_rate'] ?? 0);
        $data['vat_amount'] = $data['vat_amount'] ?? round($subtotal * $vatRate / 100, 2);
        $data['total_amount'] = $data['total_amount'] ?? round($subtotal + (float) $data['vat_amount'], 2);
        $data['deposit_amount'] = $data['deposit_amount'] ?? $data['total_amount'];

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'quotationCode' => 'quotation_code',
            'leadId' => 'lead_id',
            'customerId' => 'customer_id',
            'projectId' => 'project_id',
            'contractId' => 'contract_id',
            'serviceId' => 'service_id',
            'serviceCode' => 'service_code',
            'serviceName' => 'service_name',
            'subtotalAmount' => 'subtotal_amount',
            'vatRate' => 'vat_rate',
            'vatAmount' => 'vat_amount',
            'totalAmount' => 'total_amount',
            'depositAmount' => 'deposit_amount',
            'validUntil' => 'valid_until',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function applyServiceDefaults(array $data): array
    {
        if (! empty($data['service_id'])) {
            $service = DB::table('services')->where('id', $data['service_id'])->whereNull('deleted_at')->first();

            if ($service) {
                $data['service_code'] = $data['service_code'] ?? $service->code;
                $data['service_name'] = $data['service_name'] ?? $service->name;
            }
        }

        return $data;
    }

    private function normalizeItems(array $items): array
    {
        return collect($items)
            ->map(function (array $item, int $index): array {
                $item = $this->normalizeItemKeys($item);
                $item = $this->applyItemServiceDefaults($item);

                $quantity = (float) ($item['quantity'] ?? 1);
                $unitPrice = (float) ($item['unit_price'] ?? 0);
                $amountBeforeVat = (float) ($item['amount_before_vat'] ?? round($quantity * $unitPrice, 2));
                $vatRate = (float) ($item['vat_rate'] ?? 0);
                $vatAmount = (float) ($item['vat_amount'] ?? round($amountBeforeVat * $vatRate / 100, 2));

                return array_merge($item, [
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'amount_before_vat' => $amountBeforeVat,
                    'vat_rate' => $vatRate,
                    'vat_amount' => $vatAmount,
                    'amount_after_vat' => $item['amount_after_vat'] ?? round($amountBeforeVat + $vatAmount, 2),
                    'sort_order' => $item['sort_order'] ?? $index,
                ]);
            })
            ->values()
            ->all();
    }

    private function normalizeItemKeys(array $item): array
    {
        $map = [
            'serviceId' => 'service_id',
            'itemCode' => 'item_code',
            'itemName' => 'item_name',
            'unitPrice' => 'unit_price',
            'amountBeforeVat' => 'amount_before_vat',
            'vatRate' => 'vat_rate',
            'vatAmount' => 'vat_amount',
            'amountAfterVat' => 'amount_after_vat',
            'sortOrder' => 'sort_order',
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
                $item['item_code'] = $item['item_code'] ?? $service->code;
                $item['item_name'] = $item['item_name'] ?? $service->name;
            }
        }

        return $item;
    }

    private function applyItemTotals(array $data, array $items): array
    {
        if ($items === []) {
            return $data;
        }

        $subtotal = collect($items)->sum(fn (array $item): float => (float) $item['amount_before_vat']);
        $vat = collect($items)->sum(fn (array $item): float => (float) $item['vat_amount']);

        $data['subtotal_amount'] = round($subtotal, 2);
        $data['vat_amount'] = round($vat, 2);
        $data['total_amount'] = round($subtotal + $vat, 2);
        $data['deposit_amount'] = $data['deposit_amount'] ?? $data['total_amount'];

        return $data;
    }

    private function syncItems(Quotation $quotation, array $items): void
    {
        $quotation->items()->delete();

        foreach ($items as $item) {
            $quotation->items()->create($item);
        }
    }

    private function generateQuotationCode(array $data): string
    {
        $baseCode = $this->quotationBaseCode($data);
        $nextNumber = ((int) DB::table('quotations')
            ->where('quotation_code', 'like', $baseCode.'.Q%')
            ->whereRaw("quotation_code ~ ?", ['^'.preg_quote($baseCode, '/').'\\.Q[0-9]+$'])
            ->selectRaw("MAX(CAST(SUBSTRING(quotation_code FROM '\\.Q([0-9]+)$') AS INTEGER)) as max_number")
            ->value('max_number')) + 1;

        do {
            $code = sprintf('%s.Q%03d', $baseCode, $nextNumber);
            $nextNumber++;
        } while (DB::table('quotations')->where('quotation_code', $code)->exists());

        return $code;
    }

    private function quotationBaseCode(array $data): string
    {
        if (! empty($data['project_id'])) {
            $projectCode = DB::table('projects')->where('id', $data['project_id'])->value('project_code');

            if ($projectCode) {
                return $this->normalizeCodeSegment($projectCode);
            }
        }

        $metadata = is_array($data['metadata'] ?? null) ? $data['metadata'] : [];
        $explicitBase = $metadata['projectCodeBase'] ?? null;

        if (is_string($explicitBase) && trim($explicitBase) !== '') {
            return $this->normalizeCodeSegment($explicitBase);
        }

        $leadCode = DB::table('leads')->where('id', $data['lead_id'])->value('lead_code') ?: 'LD';
        $serviceCode = $this->rootServiceCode($data['service_id'] ?? null) ?: ($data['service_code'] ?? 'DV');
        $projectName = $metadata['projectName'] ?? null;
        $parts = [$leadCode, $serviceCode];

        if (is_string($projectName) && trim($projectName) !== '') {
            $parts[] = $projectName;
        }

        return collect($parts)
            ->map(fn (string $part): string => $this->normalizeCodeSegment($part))
            ->filter()
            ->join('.');
    }

    private function rootServiceCode(?string $serviceId): ?string
    {
        if (! $serviceId) {
            return null;
        }

        $service = DB::table('services')->where('id', $serviceId)->whereNull('deleted_at')->first(['id', 'parent_id', 'code']);

        while ($service && $service->parent_id) {
            $parent = DB::table('services')->where('id', $service->parent_id)->whereNull('deleted_at')->first(['id', 'parent_id', 'code']);

            if (! $parent) {
                break;
            }

            $service = $parent;
        }

        return $service?->code;
    }

    private function normalizeCodeSegment(string $value): string
    {
        $value = Str::ascii(trim($value));
        $value = preg_replace('/\s+/', '', $value) ?: '';
        $value = preg_replace('/[^A-Za-z0-9._-]/', '', $value) ?: '';

        return Str::upper($value);
    }

    private function paymentCollectionStatus(
        float $receivedAmount,
        float $totalAmount,
        string $matchStatus,
    ): string {
        if ($receivedAmount <= 0) {
            return $matchStatus;
        }

        if ($receivedAmount < $totalAmount) {
            return 'partial';
        }

        if ($receivedAmount > $totalAmount) {
            return 'overpaid';
        }

        return 'paid';
    }
}
