<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isSuperAdmin();
    }

    public function rules(): array
    {
        $userId = $this->route('id');
        return [
            'name' => 'sometimes|required|string|max:255',
            'username' => 'sometimes|required|string|max:100|unique:users,username,' . $userId,
            'password' => 'sometimes|nullable|string|min:6',
            'role' => 'sometimes|required|string|in:operator,verifikator,super_admin',
            'region' => 'nullable|string|max:100',
            'kcu' => 'nullable|string|max:100',
            'kcp' => 'nullable|string|max:100',
            'is_active' => 'sometimes|boolean',
        ];
    }
}
