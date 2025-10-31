"use client";

import { useState } from "react";
import {
  Search,
  Shield,
  UserPlus,
  Edit,
  Trash,
  AlertTriangle,
} from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for admin users
const adminUsersData = [
  {
    id: "A001",
    name: "Admin User",
    email: "admin@example.com",
    role: "Super Admin",
    permissions: [
      "manage_pireps",
      "manage_applications",
      "manage_routes",
      "manage_users",
      "manage_admins",
      "manage_settings",
    ],
    lastActive: "2023-03-15T18:30:00Z",
    createdAt: "2022-01-01T10:00:00Z",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "A002",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    role: "PIREP Manager",
    permissions: ["manage_pireps"],
    lastActive: "2023-03-14T12:45:00Z",
    createdAt: "2022-02-15T14:30:00Z",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "A003",
    name: "Robert Wilson",
    email: "robert.wilson@example.com",
    role: "Route Manager",
    permissions: ["manage_routes"],
    lastActive: "2023-03-10T09:20:00Z",
    createdAt: "2022-03-10T11:15:00Z",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "A004",
    name: "Emily Davis",
    email: "emily.davis@example.com",
    role: "Application Reviewer",
    permissions: ["manage_applications"],
    lastActive: "2023-03-05T16:10:00Z",
    createdAt: "2022-04-05T09:45:00Z",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "A005",
    name: "Michael Johnson",
    email: "michael.johnson@example.com",
    role: "Admin",
    permissions: [
      "manage_pireps",
      "manage_applications",
      "manage_routes",
      "manage_users",
    ],
    lastActive: "2023-03-01T14:30:00Z",
    createdAt: "2022-05-20T13:20:00Z",
    avatar: "/placeholder.svg?height=40&width=40",
  },
];

// Mock data for roles
const rolesData = [
  {
    id: "R001",
    name: "Super Admin",
    description: "Full access to all system features and settings",
    permissions: [
      "manage_pireps",
      "manage_applications",
      "manage_routes",
      "manage_users",
      "manage_admins",
      "manage_settings",
    ],
    createdAt: "2022-01-01T10:00:00Z",
    updatedAt: "2022-01-01T10:00:00Z",
    userCount: 1,
  },
  {
    id: "R002",
    name: "Admin",
    description: "Access to most system features except admin management",
    permissions: [
      "manage_pireps",
      "manage_applications",
      "manage_routes",
      "manage_users",
    ],
    createdAt: "2022-01-01T10:00:00Z",
    updatedAt: "2022-01-01T10:00:00Z",
    userCount: 1,
  },
  {
    id: "R003",
    name: "PIREP Manager",
    description: "Can manage and process pilot reports",
    permissions: ["manage_pireps"],
    createdAt: "2022-01-01T10:00:00Z",
    updatedAt: "2022-01-01T10:00:00Z",
    userCount: 1,
  },
  {
    id: "R004",
    name: "Route Manager",
    description: "Can manage flight routes and schedules",
    permissions: ["manage_routes"],
    createdAt: "2022-01-01T10:00:00Z",
    updatedAt: "2022-01-01T10:00:00Z",
    userCount: 1,
  },
  {
    id: "R005",
    name: "Application Reviewer",
    description: "Can review and process user applications",
    permissions: ["manage_applications"],
    createdAt: "2022-01-01T10:00:00Z",
    updatedAt: "2022-01-01T10:00:00Z",
    userCount: 1,
  },
];

// Available permissions
const availablePermissions = [
  {
    id: "manage_pireps",
    name: "Manage PIREPs",
    description: "Review, approve, and reject pilot reports",
  },
  {
    id: "manage_applications",
    name: "Manage Applications",
    description: "Review, approve, and reject user applications",
  },
  {
    id: "manage_routes",
    name: "Manage Routes",
    description: "Create, edit, and delete flight routes",
  },
  {
    id: "manage_users",
    name: "Manage Users",
    description: "View and edit user profiles and settings",
  },
  {
    id: "manage_admins",
    name: "Manage Admins",
    description: "Add, edit, and remove admin users",
  },
  {
    id: "manage_settings",
    name: "Manage Settings",
    description: "Configure system-wide settings",
  },
];

export default function AdminPermissions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showAddAdminDialog, setShowAddAdminDialog] = useState(false);

  // Filter admin users based on search and role filter
  const filteredAdmins = adminUsersData.filter((admin) => {
    const matchesSearch =
      admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.role.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" ? true : admin.role === roleFilter;

    return matchesSearch && matchesRole;
  });
  // Handle adding a new admin
  const handleAddAdmin = (formData: FormData) => {
    // In a real app, you would call an API to add a new admin
    console.log("Adding new admin:", Object.fromEntries(formData));
    setShowAddAdminDialog(false);
  };

  return (
    <CrewHeader>
      <main className="flex-1">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">Admin Permissions</h1>

          <div className="flex items-center gap-2">
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
                  <DialogTitle>Add New Admin</DialogTitle>
                  <DialogDescription>
                    Add a new administrator to the system. They will receive an
                    email with login instructions.
                  </DialogDescription>
                </DialogHeader>

                <form action={handleAddAdmin} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="john.doe@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select name="role" required>
                      <SelectTrigger>
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
                    <p className="text-xs text-muted-foreground">
                      The role determines what permissions the admin will have.
                    </p>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddAdminDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Add Admin</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Search Admins</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={"Search by name, email, role..."}
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                  {rolesData.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader className="p-4">
              <CardTitle>Admin Users</CardTitle>
              <CardDescription>
                Manage administrators and their permissions
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
                  {filteredAdmins.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No admin users found matching your criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAdmins.map((admin) => (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={admin.avatar}
                                alt={admin.name}
                              />
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
                            {admin.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {admin.permissions.length > 3 ? (
                              <>
                                <Badge variant="secondary" className="text-xs">
                                  {admin.permissions.slice(0, 2).join(", ")}
                                </Badge>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        +{admin.permissions.length - 2} more
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{admin.permissions.join(", ")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </>
                            ) : (
                              admin.permissions.map((permission) => (
                                <Badge
                                  key={permission}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {permission.replace("manage_", "")}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {new Date(admin.lastActive).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
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
                                    Are you sure?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove admin access for{" "}
                                    {admin.name}. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction>Delete</AlertDialogAction>
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
      </main>
    </CrewHeader>
  );
}
