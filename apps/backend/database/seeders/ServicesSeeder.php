<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ServicesSeeder extends Seeder
{
    public function run(): void
    {
        $path = storage_path('imports/services.csv');

        if (! file_exists($path)) {
            $this->command?->error("Khong tim thay file import: {$path}");

            return;
        }

        DB::transaction(function () use ($path): void {
            $handle = fopen($path, 'rb');

            if (! $handle) {
                $this->command?->error("Khong the doc file import: {$path}");

                return;
            }

            fgetcsv($handle);

            $root = null;
            $group = null;
            $rootOrder = 0;
            $groupOrder = 0;
            $itemOrder = 0;
            $currentInvoiceContent = null;
            $currentInvoiceTiming = null;

            while (($row = fgetcsv($handle)) !== false) {
                $list = $this->cell($row, 9);
                $category = $this->cell($row, 10);
                $code = $this->cell($row, 11);
                $content = $this->cell($row, 12);
                $invoiceContent = $this->cell($row, 13);
                $invoiceTiming = $this->cell($row, 14);

                if ($list !== '') {
                    $rootOrder++;
                    $groupOrder = 0;
                    $itemOrder = 0;
                    $rootLabel = $list;

                    if (! $this->hasCodePrefix($list) && $category !== '' && ! $this->hasCodePrefix($category)) {
                        $rootLabel = "{$list}: {$category}";
                    }

                    $root = $this->upsertService(null, $rootLabel, null, [
                        'level' => 1,
                        'sort_order' => $rootOrder,
                    ]);
                    $group = null;
                    $currentInvoiceContent = null;
                    $currentInvoiceTiming = null;
                }

                if (! $root) {
                    continue;
                }

                if ($invoiceContent !== '') {
                    $currentInvoiceContent = $invoiceContent;
                }

                if ($invoiceTiming !== '') {
                    $currentInvoiceTiming = $invoiceTiming;
                }

                if ($category !== '' && $this->hasCodePrefix($category)) {
                    $groupOrder++;
                    $itemOrder = 0;
                    $group = $this->upsertService($root->id, $category, null, [
                        'level' => 2,
                        'sort_order' => $groupOrder,
                    ]);
                }

                if ($code === '' && $content === '') {
                    continue;
                }

                $itemOrder++;
                $parent = $group ?: $root;
                $name = $content !== '' ? $content : ($category !== '' ? $category : $code);

                $this->upsertService($parent->id, $code, $name, [
                    'content' => $content !== '' ? $content : $name,
                    'invoice_content' => $currentInvoiceContent,
                    'invoice_timing' => $currentInvoiceTiming,
                    'level' => $parent->level + 1,
                    'sort_order' => $itemOrder,
                ]);
            }

            fclose($handle);
        });
    }

    private function cell(array $row, int $index): string
    {
        return trim((string) ($row[$index] ?? ''));
    }

    private function hasCodePrefix(string $value): bool
    {
        return preg_match('/^[A-Z]{1,5}\d*(?:\.\d+)*\s*:/u', $value) === 1;
    }

    private function upsertService(?string $parentId, string $rawCodeOrLabel, ?string $name, array $data): Service
    {
        [$code, $label] = $this->parseCodeAndLabel($rawCodeOrLabel);
        $name ??= $label;

        /** @var Service $service */
        $service = Service::query()->updateOrCreate(
            [
                'parent_id' => $parentId,
                'code' => $code,
            ],
            array_merge([
                'name' => $name,
                'description' => null,
                'is_active' => true,
            ], $data),
        );

        return $service;
    }

    private function parseCodeAndLabel(string $value): array
    {
        if (preg_match('/^(?<code>[A-Z]{1,5}\d*(?:\.\d+)*)\s*:\s*(?<label>.+)$/u', $value, $matches) === 1) {
            return [$matches['code'], $matches['label']];
        }

        return [$value, $value];
    }
}
