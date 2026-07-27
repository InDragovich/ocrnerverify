<?php

namespace App\Http\Requests;

use App\Services\WilayahService;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class StoreVerifikasiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isOperator();
    }

    public function rules(): array
    {
        $rules = [
            'kategori' => 'required|string|max:100',
            'tahun' => 'required|integer|min:2000|max:2099',
            'triwulan' => 'required|integer|min:1|max:4',
            'periode' => 'required|string|in:Januari,Februari,Maret,April,Mei,Juni,Juli,Agustus,September,Oktober,November,Desember',
            'nominal_pelaporan' => 'required|integer|min:0',
            'lampiran' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ];

        // Operator lintas wilayah menentukan sendiri wilayah dokumen; operator
        // yang terikat wilayah tidak mengirim kolom ini sama sekali karena
        // nilainya diambil dari profilnya.
        if ($this->user()?->isOperatorLintasWilayah()) {
            $rules['regional'] = 'required|string';
            $rules['kcu'] = 'required|string';
            $rules['kpc'] = 'required|string';
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (!$this->user()?->isOperatorLintasWilayah()) {
                return;
            }
            if ($validator->errors()->hasAny(['regional', 'kcu', 'kpc'])) {
                return;
            }

            if (!WilayahService::kombinasiValid($this->regional, $this->kcu, $this->kpc)) {
                $validator->errors()->add(
                    'kpc',
                    'Kombinasi regional, KCU, dan KPC tidak terdaftar pada data master wilayah.',
                );
            }
        });
    }

    public function messages(): array
    {
        return [
            'lampiran.mimes' => 'Format file harus PDF, JPG, atau PNG.',
            'lampiran.max' => 'Ukuran file maksimal 5MB.',
            'periode.in' => 'Periode harus berupa nama bulan yang valid.',
            'triwulan.min' => 'Triwulan harus antara 1 sampai 4.',
            'triwulan.max' => 'Triwulan harus antara 1 sampai 4.',
            'regional.required' => 'Regional wajib dipilih.',
            'kcu.required' => 'KCU wajib dipilih.',
            'kpc.required' => 'KPC wajib dipilih.',
        ];
    }
}
