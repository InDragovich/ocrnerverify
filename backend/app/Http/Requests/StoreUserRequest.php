<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:100|unique:users,username',
            'password' => 'required|string|min:6',
            'role' => 'required|string|in:operator,verifikator,super_admin',
            'region' => ['nullable', 'string', Rule::in(config('wilayah.regional'))],
            'kcu' => 'nullable|string|max:100',
            'kcp' => 'nullable|string|max:100',
        ];
    }
}
