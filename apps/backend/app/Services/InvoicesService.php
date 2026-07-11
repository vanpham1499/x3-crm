<?php

namespace App\Services;

use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Models\Revenue;
use App\Repositories\InvoiceRepository;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class InvoicesService extends BaseService
{
    public function __construct(private readonly InvoiceRepository $invoices) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->invoices->findAll($this->normalizeKeys($filters)), InvoiceResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->invoices->findWithRelationsOrFail($id), InvoiceResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizePayload($data);
            $data = $this->applyRevenueDefaults($data);
            $data['status'] = $data['status'] ?? Invoice::STATUS_DRAFT;
            $data['invoice_no'] = $data['invoice_no'] ?? $this->generateInvoiceNo();

            /** @var Invoice $invoice */
            $invoice = $this->invoices->create($data);
            $this->syncRevenueInvoiceStatus($invoice);

            return $this->apiResource($invoice->load(['revenue.project', 'customer']), InvoiceResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $data = $this->normalizePayload($data);

            /** @var Invoice $invoice */
            $invoice = $this->invoices->update($id, $data);
            $this->syncRevenueInvoiceStatus($invoice);

            return $this->apiResource($invoice->load(['revenue.project', 'customer']), InvoiceResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var Invoice $invoice */
            $invoice = $this->invoices->findOrFail($id);
            $revenueId = $invoice->revenue_id;

            $this->invoices->delete($id);

            if ($revenueId) {
                Revenue::query()->whereKey($revenueId)->update(['invoice_status' => Revenue::INVOICE_STATUS_NOT_ISSUED]);
            }

            return ['message' => 'Xóa hóa đơn thành công'];
        });
    }

    private function syncRevenueInvoiceStatus(Invoice $invoice): void
    {
        if (! $invoice->revenue_id) {
            return;
        }

        $revenueInvoiceStatus = $invoice->status === Invoice::STATUS_ISSUED
            ? Revenue::INVOICE_STATUS_ISSUED
            : Revenue::INVOICE_STATUS_NOT_ISSUED;

        Revenue::query()->whereKey($invoice->revenue_id)->update(['invoice_status' => $revenueInvoiceStatus]);
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        foreach (['revenue_id', 'customer_id'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'revenueId' => 'revenue_id',
            'customerId' => 'customer_id',
            'invoiceType' => 'invoice_type',
            'invoiceNo' => 'invoice_no',
            'issuedDate' => 'issued_date',
            'companyName' => 'company_name',
            'taxCode' => 'tax_code',
            'receiverEmail' => 'receiver_email',
            'amountBeforeVat' => 'amount_before_vat',
            'vatAmount' => 'vat_amount',
            'amountAfterVat' => 'amount_after_vat',
            'fileUrl' => 'file_url',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function applyRevenueDefaults(array $data): array
    {
        if (empty($data['revenue_id'])) {
            return $data;
        }

        /** @var Revenue|null $revenue */
        $revenue = Revenue::query()->with('project.customer')->find($data['revenue_id']);

        if (! $revenue) {
            throw new UnprocessableEntityHttpException('Doanh thu không tồn tại');
        }

        $customer = $revenue->project?->customer;

        $data['customer_id'] = $data['customer_id'] ?? $customer?->id;
        $data['company_name'] = $data['company_name'] ?? $customer?->company_name ?? $customer?->customer_name;
        $data['tax_code'] = $data['tax_code'] ?? $customer?->tax_code;
        $data['address'] = $data['address'] ?? $customer?->address;
        $data['receiver_email'] = $data['receiver_email'] ?? $customer?->email;
        $data['amount_before_vat'] = $data['amount_before_vat'] ?? $revenue->amount_before_vat;
        $data['vat_amount'] = $data['vat_amount'] ?? $revenue->vat_amount;
        $data['amount_after_vat'] = $data['amount_after_vat'] ?? $revenue->amount_after_vat;

        if (empty($data['customer_id'])) {
            throw new UnprocessableEntityHttpException('Không xác định được khách hàng cho hóa đơn — dự án chưa gắn khách hàng');
        }

        return $data;
    }

    private function generateInvoiceNo(): string
    {
        $year = now()->format('Y');
        $nextNumber = ((int) DB::table('invoices')
            ->where('invoice_no', 'like', "HD{$year}%")
            ->selectRaw("MAX(CAST(SUBSTRING(invoice_no FROM '".preg_quote('HD'.$year, '/')."([0-9]+)$') AS INTEGER)) as max_number")
            ->value('max_number')) + 1;

        do {
            $code = sprintf('HD%s%04d', $year, $nextNumber);
            $nextNumber++;
        } while (DB::table('invoices')->where('invoice_no', $code)->exists());

        return $code;
    }
}
