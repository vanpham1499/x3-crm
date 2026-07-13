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

        if ($normalizedCode === '') {
            return false;
        }

        $codeLength = strlen($normalizedCode);
        $textLength = strlen($normalizedText);
        $offset = 0;

        // Only guard the trailing edge: real transfer content commonly has account/reference
        // numbers immediately before the code (a legitimate digit-to-digit adjacency), but a
        // short code being a numeric prefix of a longer, unrelated number after it (e.g. "Q001"
        // inside "Q0011") is the actual false-positive risk we need to reject.
        while (($position = strpos($normalizedText, $normalizedCode, $offset)) !== false) {
            $charAfter = ($position + $codeLength) < $textLength ? $normalizedText[$position + $codeLength] : null;
            $extendsAfter = $charAfter !== null && self::sameCharClass($charAfter, $normalizedCode[$codeLength - 1]);

            if (! $extendsAfter) {
                return true;
            }

            $offset = $position + 1;
        }

        return false;
    }

    private static function sameCharClass(string $a, string $b): bool
    {
        return ctype_digit($a) === ctype_digit($b);
    }
}
