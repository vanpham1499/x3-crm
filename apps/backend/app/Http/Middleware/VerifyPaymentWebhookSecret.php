<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the public, unauthenticated /payments/webhook endpoint. Bank/payment-gateway
 * webhooks can't use session or Sanctum auth, so they authenticate with a shared secret
 * instead — sent as `Authorization: Apikey <secret>` (SePay's convention) or
 * `Authorization: Bearer <secret>` (generic).
 *
 * Fails closed: if PAYMENT_WEBHOOK_SECRET is not configured, every request is rejected
 * rather than silently accepted, since an unconfigured secret must never mean "open".
 */
class VerifyPaymentWebhookSecret
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.payment_webhook.secret');

        if ($expected === '') {
            return response()->json([
                'message' => 'Webhook chưa được cấu hình PAYMENT_WEBHOOK_SECRET.',
            ], 503);
        }

        $header = (string) $request->header('Authorization', '');
        $token = preg_match('/^(Apikey|Bearer)\s+(.+)$/i', $header, $matches) ? $matches[2] : $header;

        if ($token === '' || ! hash_equals($expected, $token)) {
            return response()->json(['message' => 'Không xác thực được webhook.'], 401);
        }

        return $next($request);
    }
}
