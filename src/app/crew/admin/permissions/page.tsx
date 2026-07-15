"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Edit, Search, Trash, UserPlus } from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { authFetch } from "@/lib/utils/api";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  callsign: string;
  joined: string;
  lastActive: string | null;
  permissions: string[];
};

const rolesData = [
  {
    id: "super_admin",
    name: "Super Admin",
    permissions: ["admin"],
  },
  {
    id: "admin",
    name: "Admin",
    permissions: ["home", "pireps", "routes", "users", "aircrafts", "ranks", "awards"],
  },
  {
    id: "pirep_manager",
    name: "PIREP Manager",
    permissions: ["home", "pireps"],
  },
  {
    id: "route_manager",
    name: "Route Manager",
    permissions: ["home", "routes"],
  },
  {
    id: "user_manager",
    name: "User Manager",
    permissions: ["home", "users"],
  },
  {
    id: "aircraft_manager",
    name: "Aircraft Manager",
    permissions: ["home", "aircrafts"],
  },
  {
    id: "rank_manager",
    name: "Rank Manager",
    permissions: ["home", "ranks"],
  },
  {
    id: "award_manager",
    name: "Award Manager",
    permissions: ["home", "awards"],
  },
  {
    id: "permissions_manager",
    name: "Permissions Manager",
    permissions: ["home", "permissions"],
  },
];

const availablePermissions = [
  {
    id: "home",
    name: "Admin Dashboard",
    description: "View admin dashboard metrics",
  },
  {
    id: "pireps",
    name: "Manage PIREPs",
    description: "Review, approve, and reject pilot reports",
  },
  {
    id: "routes",
    name: "Manage Routes",
    description: "Create, edit, and delete flight routes",
  },
  {
    id: "users",
    name: "Manage Users",
    description: "View and edit user profiles and applications",
  },
  {
    id: "aircrafts",
    name: "Manage Aircrafts",
    description: "Manage aircraft records",
  },
  {
    id: "ranks",
    name: "Manage Ranks",
    description: "Create and edit pilot ranks and public rank presentation",
  },
  {
    id: "awards",
    name: "Manage Awards",
    description: "Manage award definitions and pilot award assignments",
  },
  {
    id: "permissions",
    name: "Manage Permissions",
    description: "Grant and remove admin permissions",
  },
  {
    id: "admin",
    name: "Full Admin Access",
    description: "Access every admin area",
  },
];

function getRoleName(permissions: string[]) {
  if (permissions.includes("admin")) {
    return "Super Admin";
  }

  const sortedPermissions = [...permissions].sort().join(",");
  const role = rolesData.find(
    (role) => [...role.permissions].sort().join(",") === sortedPermissions,
  );

  return role?.name || "Custom";
}

function formatDate(date: string | null) {
  if (!date) {
    return "Never";
  }

  return new Date(date).toLocaleDateString();
}

function permissionLabel(permissionId: string) {
  return (
    availablePermissions.find((permission) => permission.id === permissionId)
      ?.name || permissionId
  );
}

export default function AdminPermissions() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showAddAdminDialog, setShowAddAdminDialog] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("admin");
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAdmins = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/admin/permissions");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load permissions");
      }

      setAdmins(Array.isArray(data.admins) ? data.admins : []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load permissions",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const filteredAdmins = useMemo(() => {
    return admins.filter((admin) => {
      const role = getRoleName(admin.permissions);
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        admin.name.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query) ||
        admin.callsign.toLowerCase().includes(query) ||
        role.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [admins, roleFilter, searchQuery]);

  const openEditDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setSelectedPermissions(admin.permissions);
    setError("");
    setMessage("");
  };

  const togglePermission = (permissionId: string, checked: boolean) => {
    setSelectedPermissions((current) => {
      if (checked) {
        return Array.from(new Set([...current, permissionId]));
      }

      return current.filter((permission) => permission !== permissionId);
    });
  };

  const handleAddAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newAdminEmail,
          role: newAdminRole,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add admin");
      }

      setMessage("Admin permissions saved.");
      setNewAdminEmail("");
      setNewAdminRole("admin");
      setShowAddAdminDialog(false);
      await loadAdmins();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to add admin");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedAdmin) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedAdmin.id,
          permissions: selectedPermissions,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update permissions");
      }

      setMessage("Permissions updated.");
      setSelectedAdmin(null);
      await loadAdmins();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to update permissions",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAdmin = async (admin: AdminUser) => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch(`/api/admin/permissions?id=${admin.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to remove admin access");
      }

      setMessage("Admin access removed.");
      await loadAdmins();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to remove admin access",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <CrewHeader>
      <main className="flex-1">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">Admin Permissions</h1>

          <Dialog
            open={showAddAdminDialog}
            onOpenChange={setShowAddAdminDialog}
          >
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                <span>Add Admin</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Admin Access</DialogTitle>
                <DialogDescription>
                  Grant admin permissions to an existing pilot account.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddAdmin} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Pilot Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="pilot@example.com"
                    value={newAdminEmail}
                    onChange={(event) => setNewAdminEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newAdminRole} onValueChange={setNewAdminRole}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesData.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddAdminDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Add Admin"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {(message || error) && (
          <div
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Search Admins</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, email, callsign, role..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 min-w-[200px]">
              <Label htmlFor="role-filter">Filter by Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger id="role-filter">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {[...new Set(rolesData.map((role) => role.name))].map(
                    (role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ),
                  )}
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader className="p-4">
              <CardTitle>Admin Users</CardTitle>
              <CardDescription>
                Manage administrators and their database-backed permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Permissions
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Last Active
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center">
                        Loading permissions...
                      </TableCell>
                    </TableRow>
                  ) : filteredAdmins.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No admin users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAdmins.map((admin) => (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {admin.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{admin.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {admin.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary"
                          >
                            {getRoleName(admin.permissions)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex max-w-xl flex-wrap gap-1">
                            {admin.permissions.map((permission) => (
                              <Badge
                                key={permission}
                                variant="secondary"
                                className="text-xs"
                              >
                                {permissionLabel(permission)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatDate(admin.lastActive)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(admin)}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Remove admin access?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove every admin permission for{" "}
                                    {admin.name}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemoveAdmin(admin)}
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={Boolean(selectedAdmin)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedAdmin(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Permissions</DialogTitle>
              <DialogDescription>
                {selectedAdmin
                  ? `Update admin access for ${selectedAdmin.name}.`
                  : "Update admin access."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              {availablePermissions.map((permission) => (
                <div
                  key={permission.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    id={`permission-${permission.id}`}
                    checked={selectedPermissions.includes(permission.id)}
                    onCheckedChange={(checked) =>
                      togglePermission(permission.id, checked === true)
                    }
                  />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor={`permission-${permission.id}`}>
                      {permission.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {permission.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedAdmin(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePermissions} disabled={saving}>
                {saving ? "Saving..." : "Save Permissions"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </CrewHeader>
  );
}
