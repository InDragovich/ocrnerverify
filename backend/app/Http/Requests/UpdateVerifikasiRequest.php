<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateVerifikasiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isOperator();
    }

    public function rules(): array
    {
        return [
            'kategori' => 'sometimes|required|string|max:100',
            'tahun' => 'sometimes|required|integer|min:2000|max:2099',
            'triwulan' => 'sometimes|required|integer|min:1|max:4',
            'periode' => 'sometimes|required|string|in:Januari,Februari,Maret,April,Mei,Juni,Juli,Agustus,September,Oktober,November,Desember',
            'nominal_pelaporan' => 'sometimes|required|integer|min:0',
            'lampiran' => 'sometimes|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ];
    }

    public function messages(): array
    {
        return [
            'lampiran.mimes' => 'Format file harus PDF, JPG, atau PNG.',
            'lampiran.max' => 'Ukuran file maksimal 5MB.',
        ];
    }
}
