<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreVerifikasiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isOperator();
    }

    public function rules(): array
    {
        return [
            'kategori' => 'required|string|max:100',
            'tahun' => 'required|integer|min:2000|max:2099',
            'triwulan' => 'required|integer|min:1|max:4',
            'periode' => 'required|string|in:Januari,Februari,Maret,April,Mei,Juni,Juli,Agustus,September,Oktober,November,Desember',
            'nominal_pelaporan' => 'required|integer|min:0',
            'lampiran' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ];
    }

    public function messages(): array
    {
        return [
            'lampiran.mimes' => 'Format file harus PDF, JPG, atau PNG.',
            'lampiran.max' => 'Ukuran file maksimal 5MB.',
            'periode.in' => 'Periode harus berupa nama bulan yang valid.',
            'triwulan.min' => 'Triwulan harus antara 1 sampai 4.',
            'triwulan.max' => 'Triwulan harus antara 1 sampai 4.',
        ];
    }
}
