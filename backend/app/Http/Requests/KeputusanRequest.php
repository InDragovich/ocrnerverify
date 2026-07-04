<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class KeputusanRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && ($user->isVerifikator() || $user->isSuperAdmin());
    }

    public function rules(): array
    {
        return [
            'hasil_kesesuaian' => 'required|string|in:sesuai,tidak_sesuai',
            'catatan_verifikator' => 'nullable|string|max:2000',
            'koreksi_entitas' => 'nullable|array',
            'koreksi_entitas.nominal' => 'nullable|numeric|min:0',
            'koreksi_entitas.kategori' => 'nullable|string|in:Listrik,Telepon,Air dan Gas',
            'koreksi_entitas.periode' => 'nullable|string|max:50',
        ];
    }
}
