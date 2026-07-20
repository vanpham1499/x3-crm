FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

FROM php:8.4-cli-alpine
WORKDIR /app

RUN apk add --no-cache postgresql-dev \
    && docker-php-ext-install pdo_pgsql opcache

COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY .deploy/production/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

RUN mkdir -p \
      storage/framework/cache/data \
      storage/framework/sessions \
      storage/framework/views \
      storage/logs \
      public/uploads \
    && php artisan package:discover --ansi

EXPOSE 4000
