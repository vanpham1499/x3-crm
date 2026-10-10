FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

FROM php:8.2-fpm-alpine
WORKDIR /app
RUN apk add --no-cache postgresql-dev libzip-dev curl-dev oniguruma-dev su-exec libjxl-tools && docker-php-ext-install pdo_pgsql pcntl zip curl mbstring
COPY . .
COPY --from=vendor /app/vendor ./vendor
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache \
 && printf 'memory_limit=192M\nmax_execution_time=900\npost_max_size=260M\nupload_max_filesize=256M\n' > /usr/local/etc/php/conf.d/zalo-limits.ini \
 && printf '[www]\npm=ondemand\npm.max_children=2\npm.process_idle_timeout=15s\npm.max_requests=100\nclear_env=no\n' > /usr/local/etc/php-fpm.d/zz-zalo.conf
RUN php artisan package:discover --ansi
# No automatic migration, CRM seed or scheduler on startup.
RUN sed -i 's/\r$//' /app/docker/zalo-entrypoint.sh && chmod 755 /app/docker/zalo-entrypoint.sh
ENTRYPOINT ["/app/docker/zalo-entrypoint.sh"]
CMD ["php-fpm", "-F"]
