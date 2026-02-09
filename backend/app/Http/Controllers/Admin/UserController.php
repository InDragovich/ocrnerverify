<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query();

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('username', 'like', "%{$search}%");
            });
        }

        $perPage = $request->input('per_page', 15);
        $users = $query->orderBy('name')->paginate($perPage);

        return response()->json($users);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = User::create([
            'name' => $request->name,
            'username' => $request->username,
            'password' => $request->password,
            'role' => $request->role,
            'region' => $request->region,
            'kcu' => $request->kcu,
            'kcp' => $request->kcp,
        ]);

        AuditService::log('create_user', User::class, $user->id, null, $user->toArray());

        return response()->json([
            'message' => 'User berhasil dibuat.',
            'data' => $user,
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        return response()->json($user);
    }

    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $oldValues = $user->toArray();

        $data = $request->only(['name', 'username', 'role', 'region', 'kcu', 'kcp', 'is_active']);

        if ($request->filled('password')) {
            $data['password'] = $request->password;
        }

        $user->update($data);

        AuditService::log('update_user', User::class, $user->id, $oldValues, $user->fresh()->toArray());

        return response()->json([
            'message' => 'User berhasil diperbarui.',
            'data' => $user->fresh(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->id === request()->user()->id) {
            return response()->json(['message' => 'Anda tidak dapat menghapus akun Anda sendiri.'], 403);
        }

        AuditService::log('deactivate_user', User::class, $user->id, ['is_active' => true], ['is_active' => false]);

        $user->update(['is_active' => false]);

        return response()->json(['message' => 'User berhasil dinonaktifkan.']);
    }
}
