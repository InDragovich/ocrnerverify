<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $lampiranPath = storage_path('app/lampiran');
        if (!is_dir($lampiranPath)) {
            mkdir($lampiranPath, 0755, true);
        }
    }
}
