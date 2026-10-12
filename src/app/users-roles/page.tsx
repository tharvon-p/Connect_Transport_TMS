'use client';

import { useState } from 'react';
import { 
  useAuth, 
  ALL_SCREENS, 
  RoleDefinition, 
  UserAccount 
} from '@/lib/auth-context';
import { 
  ShieldCheck, 
  Users, 
  KeyRound, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  UserPlus, 
  Sparkles,
  ShieldAlert,
  Info
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function UsersRolesPage() {
  const { 
    roles, 
    users, 
    addUser, 
    updateUser, 
    deleteUser, 
    addRole, 
    updateRole, 
    deleteRole,
    currentUser,
    switchUser 
  } = useAuth();

  const [activeTab, setActiveTab] = useState('users');

  // User Modals
  const [openUserModal, setOpenUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    title: '',
    roleId: 'customer_support',
    avatar: '👤',
    status: 'active' as 'active' | 'inactive',
  });

  // Role Modals
  const [openRoleModal, setOpenRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    allowedPaths: [] as string[],
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
  });

  // Open Add/Edit User
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      title: '',
      roleId: roles[0]?.id || 'customer_support',
      avatar: '👤',
      status: 'active',
    });
    setOpenUserModal(true);
  };

  const handleOpenEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      title: user.title,
      roleId: user.roleId,
      avatar: user.avatar,
      status: user.status,
    });
    setOpenUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.roleId) {
      alert('กรุณากรอกชื่อและเลือก Role');
      return;
    }

    if (editingUser) {
      updateUser(editingUser.id, userForm);
    } else {
      addUser(userForm);
    }
    setOpenUserModal(false);
  };

  // Open Add/Edit Role
  const handleOpenAddRole = () => {
    setEditingRole(null);
    setRoleForm({
      name: '',
      description: '',
      allowedPaths: ['/orders'],
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    });
    setOpenRoleModal(true);
  };

  const handleOpenEditRole = (role: RoleDefinition) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description,
      allowedPaths: [...role.allowedPaths],
      badgeColor: role.badgeColor,
    });
    setOpenRoleModal(true);
  };

  const handleTogglePath = (path: string) => {
    setRoleForm((prev) => {
      const exists = prev.allowedPaths.includes(path);
      if (exists) {
        return { ...prev, allowedPaths: prev.allowedPaths.filter((p) => p !== path) };
      } else {
        return { ...prev, allowedPaths: [...prev.allowedPaths, path] };
      }
    });
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name) {
      alert('กรุณาระบุชื่อ Role');
      return;
    }
    if (roleForm.allowedPaths.length === 0) {
      alert('กรุณาเลือกสิทธิ์เข้าถึงหน้าจออย่างน้อย 1 หน้าจอ');
      return;
    }

    if (editingRole) {
      updateRole(editingRole.id, roleForm);
    } else {
      addRole(roleForm);
    }
    setOpenRoleModal(false);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
              System Administration & Security
            </span>
            <span className="text-xs text-slate-500">Connect Transport Co., Ltd.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-purple-600" />
            การจัดการผู้ใช้งานและสิทธิ์ (Users & Roles RBAC)
          </h1>
          <p className="text-slate-500 text-sm">
            สร้างบัญชีผู้ใช้, กำหนด Role ให้แต่ละคน, และตั้งค่าเปิด-ปิดสิทธิ์การเข้าถึงหน้าจอต่างๆ แบบละเอียด
          </p>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="text-2xl">{currentUser.avatar}</div>
          <div className="text-xs">
            <div className="text-slate-500">คุณกำลังใช้งานในชื่อ:</div>
            <div className="font-bold text-slate-900">{currentUser.name}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-200 p-1 rounded-xl">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            ผู้ใช้งานระบบ (Users) ({users.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <KeyRound className="h-4 w-4 text-purple-600" />
            บทบาท & กำหนดสิทธิ์หน้าจอ (Roles & Permissions) ({roles.length})
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: USERS MANAGEMENT ================= */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">รายชื่อผู้ใช้งานระบบ (User Accounts)</CardTitle>
                <CardDescription>
                  กำหนดว่าพนักงานแต่ละคนมีตำแหน่งใด และถือสิทธิ์ Role อะไรในระบบ
                </CardDescription>
              </div>
              <Button onClick={handleOpenAddUser} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <UserPlus className="h-4 w-4" />
                + เพิ่มผู้ใช้ใหม่
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/70">
                      <TableHead className="font-semibold text-slate-800">ผู้ใช้งาน</TableHead>
                      <TableHead className="font-semibold text-slate-800">อีเมล / รหัสพนักงาน</TableHead>
                      <TableHead className="font-semibold text-slate-800">ตำแหน่งงาน (Title)</TableHead>
                      <TableHead className="font-semibold text-slate-800">บทบาทที่ได้รับ (Role)</TableHead>
                      <TableHead className="font-semibold text-slate-800">สิทธิ์หน้าจอที่เข้าถึงได้</TableHead>
                      <TableHead className="text-center font-semibold text-slate-800">สถานะ</TableHead>
                      <TableHead className="text-right font-semibold text-slate-800">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const userRole = roles.find((r) => r.id === u.roleId);
                      const isMe = u.id === currentUser.id;

                      return (
                        <TableRow key={u.id} className="hover:bg-slate-50/80">
                          <TableCell className="font-semibold text-slate-900 flex items-center gap-2.5">
                            <span className="text-xl">{u.avatar}</span>
                            <div>
                              <div>{u.name}</div>
                              {isMe && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-normal">
                                  คุณกำลังล็อกอินบัญชีนี้
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 font-mono">
                            {u.email}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 font-medium">
                            {u.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`font-semibold text-xs ${userRole?.badgeColor || ''}`}>
                              {userRole?.name || u.roleId}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {userRole?.id === 'admin' ? (
                                <Badge className="bg-emerald-600 text-white text-[10px]">เข้าได้ทุกหน้าจอ (Full Access)</Badge>
                              ) : (
                                userRole?.allowedPaths.map((p) => {
                                  const screen = ALL_SCREENS.find((s) => s.path === p);
                                  return (
                                    <span key={p} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600 border">
                                      {screen?.label.split(' ')[0] || p}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {u.status === 'active' ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
                                ใช้งานปกติ
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">ระงับการใช้</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditUser(u)}
                                className="h-8 text-xs gap-1 border-slate-300"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                แก้ไข Role
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteUser(u.id)}
                                disabled={isMe}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 p-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 2: ROLES & SCREEN PERMISSION MATRIX ================= */}
        <TabsContent value="roles" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">บทบาทและสิทธิ์การเข้าถึงหน้าจอ (Roles & Screen Matrix)</CardTitle>
                <CardDescription>
                  กำหนดสิทธิ์ของแต่ละ Role โดยสามารถติ๊ก Checkbox เลือกเปิดหรือปิดการเข้าถึงแต่ละหน้าจอได้ทันที
                </CardDescription>
              </div>
              <Button onClick={handleOpenAddRole} className="gap-2 bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4" />
                + สร้าง Role ใหม่
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((r) => {
                  const userCount = users.filter((u) => u.roleId === r.id).length;

                  return (
                    <div 
                      key={r.id} 
                      className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`font-bold text-xs ${r.badgeColor}`}>
                            {r.name}
                          </Badge>
                          <span className="text-xs text-slate-500">{userCount} ผู้ใช้งาน</span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                          {r.description}
                        </p>

                        <div className="pt-2 border-t space-y-1.5">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                            หน้าจอที่มีสิทธิ์เข้าถึง ({r.id === 'admin' ? ALL_SCREENS.length : r.allowedPaths.length}/{ALL_SCREENS.length}):
                          </div>
                          <div className="space-y-1">
                            {ALL_SCREENS.map((s) => {
                              const isAllowed = r.id === 'admin' || r.allowedPaths.includes(s.path);
                              return (
                                <div key={s.path} className="flex items-center justify-between text-xs py-0.5">
                                  <span className={isAllowed ? 'text-slate-800 font-medium' : 'text-slate-400 line-through'}>
                                    {s.label}
                                  </span>
                                  {isAllowed ? (
                                    <span className="text-emerald-600 font-bold text-xs">✓ มีสิทธิ์</span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">✕ ล็อก</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t flex items-center justify-between">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditRole(r)}
                          className="text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          ตั้งค่าสิทธิ์หน้าจอ
                        </Button>

                        {!r.isSystem && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRole(r.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================= MODAL: ADD / EDIT USER ================= */}
      <Dialog open={openUserModal} onOpenChange={setOpenUserModal}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSaveUser}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                {editingUser ? 'แก้ไขข้อมูลผู้ใช้และกำหนด Role' : 'เพิ่มผู้ใช้งานใหม่'}
              </DialogTitle>
              <DialogDescription>
                กำหนดชื่อ ตำแหน่ง และมอบหมาย Role สิทธิ์การเข้าถึงให้ผู้ใช้
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1 space-y-1">
                  <Label htmlFor="u_avatar">ไอคอน</Label>
                  <select
                    id="u_avatar"
                    className="w-full border rounded-md p-2 text-base bg-white border-slate-300"
                    value={userForm.avatar}
                    onChange={(e) => setUserForm({ ...userForm, avatar: e.target.value })}
                  >
                    <option value="👨‍💻">👨‍💻</option>
                    <option value="👔">👔</option>
                    <option value="🎧">🎧</option>
                    <option value="🚛">🚛</option>
                    <option value="💰">💰</option>
                    <option value="👩‍💼">👩‍💼</option>
                    <option value="🧑‍🔧">🧑‍🔧</option>
                  </select>
                </div>
                <div className="col-span-3 space-y-1">
                  <Label htmlFor="u_name">ชื่อ - นามสกุล *</Label>
                  <Input
                    id="u_name"
                    required
                    placeholder="เช่น คุณสมศักดิ์ ขยันดี"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="u_email">อีเมล / บัญชีเข้าใช้</Label>
                <Input
                  id="u_email"
                  type="email"
                  placeholder="somsak@connecttransport.com"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="u_title">ตำแหน่งงาน (Job Title)</Label>
                <Input
                  id="u_title"
                  placeholder="เช่น เจ้าหน้าที่จ่ายงานอาวุโส, ผู้จัดการ CS"
                  value={userForm.title}
                  onChange={(e) => setUserForm({ ...userForm, title: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="u_role">กำหนดบทบาทและสิทธิ์ (Role Assignment) *</Label>
                <select
                  id="u_role"
                  required
                  className="w-full border rounded-md p-2 text-sm bg-white border-slate-300 font-semibold"
                  value={userForm.roleId}
                  onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {roles.find((r) => r.id === userForm.roleId)?.description}
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="u_status">สถานะบัญชี</Label>
                <select
                  id="u_status"
                  className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                  value={userForm.status}
                  onChange={(e) => setUserForm({ ...userForm, status: e.target.value as any })}
                >
                  <option value="active">ใช้งานปกติ (Active)</option>
                  <option value="inactive">ระงับการใช้งาน (Inactive)</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenUserModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                บันทึกข้อมูลผู้ใช้
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: ADD / EDIT ROLE & PERMISSIONS ================= */}
      <Dialog open={openRoleModal} onOpenChange={setOpenRoleModal}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveRole}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-purple-600" />
                {editingRole ? `ตั้งค่าสิทธิ์หน้าจอ: ${editingRole.name}` : 'สร้าง Role ใหม่และกำหนดสิทธิ์'}
              </DialogTitle>
              <DialogDescription>
                ติ๊ก Checkbox เพื่อเลือกหน้าจอที่ Role นี้สามารถเปิดใช้งานได้
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="space-y-1">
                <Label htmlFor="r_name">ชื่อบทบาท (Role Name) *</Label>
                <Input
                  id="r_name"
                  required
                  placeholder="เช่น หัวหน้าช่างซ่อมบำรุง, ผู้จัดการสาขาแหลมฉบัง"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="r_desc">คำอธิบายหน้าที่ความรับผิดชอบ</Label>
                <Input
                  id="r_desc"
                  placeholder="ระบุหน้าที่ของตำแหน่งนี้"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                />
              </div>

              {/* Permissions Checkbox Matrix */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-slate-900 text-sm">
                    กำหนดสิทธิ์การเข้าถึงหน้าจอ (Screen Permissions) *
                  </Label>
                  <span className="text-xs text-purple-700 font-semibold">
                    เลือกแล้ว {roleForm.allowedPaths.length}/{ALL_SCREENS.length} หน้าจอ
                  </span>
                </div>

                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {ALL_SCREENS.map((screen) => {
                    const isChecked = roleForm.allowedPaths.includes(screen.path);

                    return (
                      <div
                        key={screen.path}
                        onClick={() => handleTogglePath(screen.path)}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-purple-50/70 border-purple-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 opacity-70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent onClick
                          className="h-4 w-4 mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                            <span>{screen.label}</span>
                            <span className="font-mono text-[10px] text-slate-500 font-normal">{screen.path}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                            {screen.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenRoleModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                บันทึกการตั้งค่าสิทธิ์
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
