<?php

namespace App\Support;

use Illuminate\Support\Str;

final class QuotationReference
{
    public static function canonical(?string $value): string
    {
        if (! is_string($value) || trim($value) === '') {
            return '';
        }

        $ascii = Str::upper(Str::ascii(trim($value)));
        $withSeparators = preg_replace('/[^A-Z0-9]+/', '-', $ascii) ?: '';

        return trim($withSeparators, '-');
    }

    public static function compact(?string $value): string
    {
        return preg_replace('/[^A-Z0-9]/', '', self::canonical($value)) ?: '';
    }

    public static function appearsIn(string $text, string $quotationCode): bool
    {
        $normalizedText = self::compact($text);
        $normalizedCode = self::compact($quotationCode);

        return $normalizedCode !== '' && Str::contains($normalizedText, $normalizedCode);
    }
}
