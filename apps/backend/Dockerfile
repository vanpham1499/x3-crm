FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

FROM php:8.2-cli-alpine
WORKDIR /app

RUN apk add --no-cache postgresql-dev \
  && docker-php-ext-install pdo pdo_pgsql

COPY . .
COPY --from=vendor /app/vendor ./vendor

EXPOSE 4000
CMD ["sh", "-c", "php artisan migrate --force && php artisan db:seed --force && php -S 0.0.0.0:${PORT:-4000} -t public public/index.php"]
