FROM php:8.4-fpm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    zip \
    unzip \
    libicu-dev \
    libpq-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extensions required by Craft CMS
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
    pdo \
    pdo_mysql \
    mbstring \
    exif \
    pcntl \
    bcmath \
    gd \
    intl \
    zip \
    opcache

# Install ImageMagick
RUN apt-get update && apt-get install -y \
    libmagickwand-dev --no-install-recommends \
    && pecl install imagick \
    && docker-php-ext-enable imagick \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Configure PHP settings for production
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && echo "memory_limit = 512M" >> "$PHP_INI_DIR/conf.d/craft.ini" \
    && echo "max_execution_time = 300" >> "$PHP_INI_DIR/conf.d/craft.ini" \
    && echo "upload_max_filesize = 100M" >> "$PHP_INI_DIR/conf.d/craft.ini" \
    && echo "post_max_size = 100M" >> "$PHP_INI_DIR/conf.d/craft.ini" \
    && echo "opcache.enable=1" >> "$PHP_INI_DIR/conf.d/opcache.ini" \
    && echo "opcache.memory_consumption=256" >> "$PHP_INI_DIR/conf.d/opcache.ini" \
    && echo "opcache.interned_strings_buffer=16" >> "$PHP_INI_DIR/conf.d/opcache.ini" \
    && echo "opcache.max_accelerated_files=10000" >> "$PHP_INI_DIR/conf.d/opcache.ini" \
    && echo "opcache.validate_timestamps=0" >> "$PHP_INI_DIR/conf.d/opcache.ini"

# Copy composer files first for better caching
COPY composer.json composer.lock ./

# Install PHP dependencies (cached unless composer files change)
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# Copy application files
COPY . /var/www/html

# Create home directory for www-data user and configure git
RUN mkdir -p /var/www/.config/git \
    && chown -R www-data:www-data /var/www/.config \
    && git config --global --add safe.directory /var/www/html \
    && su www-data -s /bin/sh -c "git config --global --add safe.directory /var/www/html"

# Set proper ownership for directories that need write access
RUN chown -R www-data:www-data \
    /var/www/html/storage \
    /var/www/html/vendor \
    /var/www/html/web/cpresources \
    && chmod -R 775 \
    /var/www/html/storage \
    /var/www/html/vendor \
    /var/www/html/web/cpresources

# Expose port 9000 for PHP-FPM
EXPOSE 9000

CMD ["php-fpm"]
