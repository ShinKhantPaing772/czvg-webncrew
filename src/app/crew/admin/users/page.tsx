"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Eye,
  FileText,
  ArrowDown,
  Save,
  Pencil,
  RefreshCw,
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
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { authFetch } from "@/lib/utils/api";

interface Pilots {
  id: string;
  name: string;
  callsign: string;
  ifc: string;
  email: string;
  joined: Date;
  lastActivity?: string | null;
  status: number;
  notes: string | null;
  transhours: number;
  transflights: number;
  examStatus: number | null;
  examScore: number | string | null;
  examCompletedAt: string | null;
  examResultReceivedAt: string | null;
  discordInviteUrl: string | null;
  discordInviteSentAt: string | null;
  ifGrade: number | null;
  ifViolations: number | null;
  ifMetricsUpdatedAt: string | null;
}

interface UserEditForm {
  name: string;
  email: string;
  callsign: string;
  status: string;
}

interface ApplicationEditForm {
  examScore: string;
  discordInviteUrl: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const callsignPattern = /^China Southern \d{3}VG$/;

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateSort, setDateSort] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [users, setUsers] = useState<Pilots[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [adminNotes, setAdminNotes] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedUser, setSelectedUser] = useState<Pilots | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshingIF, setIsRefreshingIF] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editForm, setEditForm] = useState<UserEditForm>({
    name: "",
    email: "",
    callsign: "",
    status: "0",
  });
  const [applicationForm, setApplicationForm] = useState<ApplicationEditForm>({
    examScore: "",
    discordInviteUrl: "",
  });
  const [updateError, setUpdateError] = useState("");
  const itemsPerPage = 10;

  const loadUsers = async () => {
    const response = await authFetch("/api/admin/users");
    const data = await response.json();
    // Make sure it’s an array
    const usersArray = Array.isArray(data) ? data : data.users || [];
    setUsers(usersArray);
  };

  useEffect(() => {
    const fetchusers = async () => {
      try {
        await loadUsers();
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchusers();
  }, []);

  // Filter users based on search, filters, and active tab
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.ifc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.callsign.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all"
        ? true
        : user.status.toString().toLowerCase() === statusFilter.toLowerCase();
    const matchesTab =
      activeTab === "all"
        ? true
        : user.status.toString().toLowerCase() === activeTab.toLowerCase();

    return matchesSearch && matchesStatus && matchesTab;
  });

  // Sort users by date
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const dateA = new Date(a.joined).getTime();
    const dateB = new Date(b.joined).getTime();
    return dateSort === "desc" ? dateB - dateA : dateA - dateB;
  });

  // Paginate users
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const paginatedUsers = sortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "1":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Active
          </Badge>
        );
      case "0":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            Pending
          </Badge>
        );
      case "2":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            Rejected
          </Badge>
        );
      case "3":
        return (
          <Badge
            variant="outline"
            className="bg-gray-50 text-gray-700 border-gray-300"
          >
            Inactive
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "1":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "0":
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case "2":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const handleViewUser = (user: Pilots) => {
    setSelectedUser(user);
    setAdminNotes(user.notes || "");
    setEditForm({
      name: user.name,
      email: user.email,
      callsign: user.callsign,
      status: user.status.toString(),
    });
    setApplicationForm({
      examScore:
        user.examScore === null || user.examScore === undefined
          ? ""
          : String(user.examScore),
      discordInviteUrl: user.discordInviteUrl || "",
    });
    setUpdateError("");
    setIsEditingUser(false);
  };

  const handleEditFormChange = (field: keyof UserEditForm, value: string) => {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
    setUpdateError("");
  };

  const handleApplicationFormChange = (
    field: keyof ApplicationEditForm,
    value: string,
  ) => {
    setApplicationForm((current) => ({
      ...current,
      [field]: value,
    }));
    setUpdateError("");
  };

  const refreshIFMetrics = async (user: Pilots) => {
    setIsRefreshingIF(true);
    try {
      const response = await authFetch("/api/admin/users/if-metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: user.id }),
      });
      const data = await response.json();

      if (data.success) {
        const updatedUser = {
          ...user,
          ifGrade: data.ifGrade,
          ifViolations: data.ifViolations,
          ifMetricsUpdatedAt: data.ifMetricsUpdatedAt,
        };

        setUsers((currentUsers) =>
          currentUsers.map((currentUser) =>
            currentUser.id === user.id
              ? { ...currentUser, ...updatedUser }
              : currentUser,
          ),
        );
        setSelectedUser((current) =>
          current?.id === user.id ? { ...current, ...updatedUser } : current,
        );
      }
    } catch (error) {
      console.error("Error refreshing IF metrics:", error);
    } finally {
      setIsRefreshingIF(false);
    }
  };

  const handleUpdateApplication = async (user: Pilots) => {
    const scoreValue = applicationForm.examScore.trim();
    const inviteUrl = applicationForm.discordInviteUrl.trim();

    if (scoreValue) {
      const numericScore = Number(scoreValue);
      if (
        !Number.isFinite(numericScore) ||
        numericScore < 0 ||
        numericScore > 100
      ) {
        setUpdateError("Exam score must be between 0 and 100.");
        return;
      }
    }

    setIsUpdating(true);
    try {
      const response = await authFetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
          application: {
            examScore: scoreValue,
            discordInviteUrl: inviteUrl,
          },
        }),
      });
      const data = await response.json();

      if (data.success) {
        const updatedUser = {
          ...user,
          examScore: scoreValue ? Number(scoreValue) : null,
          examStatus: scoreValue ? 2 : user.examStatus,
          examResultReceivedAt: scoreValue
            ? new Date().toISOString()
            : user.examResultReceivedAt,
          discordInviteUrl: inviteUrl || null,
          discordInviteSentAt: inviteUrl ? new Date().toISOString() : null,
        };

        setUsers((currentUsers) =>
          currentUsers.map((currentUser) =>
            currentUser.id === user.id ? updatedUser : currentUser,
          ),
        );
        setSelectedUser(updatedUser);
        setUpdateError("");
      } else {
        setUpdateError(data.message || "Error updating application.");
      }
    } catch (error) {
      console.error("Error updating application:", error);
      setUpdateError("Error updating application.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateUser = async (user: Pilots) => {
    const name = editForm.name.trim();
    const email = editForm.email.trim();
    const callsign = editForm.callsign.trim();

    if (!name || !email || !callsign) {
      setUpdateError("Name, email, and assigned callsign are required.");
      return;
    }

    if (!emailPattern.test(email)) {
      setUpdateError("Enter a valid email address.");
      return;
    }

    if (!callsignPattern.test(callsign)) {
      setUpdateError("Callsign must match China Southern ###VG.");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await authFetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
          name,
          email,
          callsign,
          status: Number(editForm.status),
        }),
      });
      const data = await response.json();
      if (data.success) {
        const updatedUser = {
          ...user,
          name,
          email,
          callsign,
          status: Number(editForm.status),
        };
        setUsers((currentUsers) =>
          currentUsers.map((currentUser) =>
            currentUser.id === user.id ? updatedUser : currentUser,
          ),
        );
        setSelectedUser(updatedUser);
        setUpdateError("");
        setIsEditingUser(false);
      } else {
        setUpdateError(data.message || "Error updating user.");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      setUpdateError("Error updating user.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle application approval
  const handleApproveUser = async (user: Pilots) => {
    setIsUpdating(true);
    try {
      const response = await authFetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
          status: 1,
          notes: adminNotes,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSelectedUser(null);
        setAdminNotes("");
        await loadUsers();
      } else {
        console.error("Error approving user:", data.message);
      }
    } catch (error) {
      console.error("Error approving user:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle user rejection
  const handleRejectUser = async (user: Pilots) => {
    setIsUpdating(true);
    try {
      const response = await authFetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
          status: 2,
          notes: adminNotes,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSelectedUser(null);
        setAdminNotes("");
        await loadUsers();
      } else {
        console.error("Error rejecting user:", data.message);
      }
    } catch (error) {
      console.error("Error rejecting user:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Count users by status
  const pendingCount = users.filter((user) => user.status === 0).length;
  const approvedCount = users.filter((user) => user.status === 1).length;
  const rejectedCount = users.filter(
    (user) => user.status === 2 || user.status === 3,
  ).length;

  return (
    <CrewHeader>
      <main className="flex-1 ">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">Users</h1>
          </div>

          <Tabs
            defaultValue="all"
            className="space-y-4"
            onValueChange={(val) => setActiveTab(val)}
          >
            <div className="flex justify-between">
              <TabsList>
                <TabsTrigger value="all" className="relative">
                  All
                  <Badge className="ml-2 bg-primary/10 text-primary">
                    {users.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="0" className="relative">
                  Pending
                  <Badge className="ml-2 bg-amber-100 text-amber-700">
                    {pendingCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="1" className="relative">
                  Active
                  <Badge className="ml-2 bg-green-100 text-green-700">
                    {approvedCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="2" className="relative">
                  Rejected
                  <Badge className="ml-2 bg-red-100 text-red-700">
                    {rejectedCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDateSort(dateSort === "desc" ? "asc" : "desc")
                  }
                  className="flex items-center gap-1"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Date</span>
                  <ArrowDown
                    className={`h-4 w-4 transition-transform ${
                      dateSort === "asc" ? "rotate-180" : ""
                    }`}
                  />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1"
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="search">Search Users</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name, email, ID..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="md:hidden flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateSort(dateSort === "desc" ? "asc" : "desc")
                    }
                    className="flex items-center gap-1"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Date</span>
                    <ArrowDown
                      className={`h-4 w-4 transition-transform ${
                        dateSort === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-1"
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                  </Button>
                </div>
              </div>

              {showFilters && (
                <Card>
                  <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                      >
                        <SelectTrigger id="status">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="1">Active</SelectItem>
                          <SelectItem value="0">Pending</SelectItem>
                          <SelectItem value="2">Rejected</SelectItem>
                          <SelectItem value="3">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="p-4">
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>View and manage all user</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User Name</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          Last activity
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          IFC
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No users found matching your criteria
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{user.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {user.email}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {new Date(user.joined).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {user.lastActivity
                                ? new Date(
                                    user.lastActivity,
                                  ).toLocaleDateString()
                                : "N/A"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Link
                                href={`https://community.infiniteflight.com/u/${user.ifc}/summary`}
                              >
                                {user.ifc || "N/A"}
                              </Link>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge("" + user.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Dialog
                                onOpenChange={(open) => {
                                  if (!open) {
                                    setSelectedUser(null);
                                    setUpdateError("");
                                    setIsEditingUser(false);
                                  }
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewUser(user)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">
                                      View
                                    </span>
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto bg-white sm:max-w-[calc(100vw-2rem)] lg:max-w-6xl xl:max-w-7xl">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      {getStatusIcon("" + user.status)}
                                      <span>
                                        {user.status.toString() === "0"
                                          ? "Applicant "
                                          : user.status.toString() === "2"
                                            ? "User "
                                            : "Pilot "}
                                        Details: {user.name}
                                      </span>
                                    </DialogTitle>
                                    <DialogDescription>
                                      {user.status.toString() === "0"
                                        ? "Submitted on "
                                        : "Joined "}
                                      {new Date(user.joined).toLocaleString()}
                                    </DialogDescription>
                                  </DialogHeader>

                                  <div className="grid gap-4 py-4">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                      <div className="flex items-center gap-4">
                                        <Avatar className="h-16 w-16">
                                          <AvatarFallback>
                                            {user.name.charAt(0)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <h3 className="text-lg font-semibold">
                                            {user.name}
                                          </h3>
                                          <p className="text-sm text-muted-foreground">
                                            {user.callsign}
                                          </p>
                                          <div className="mt-1">
                                            {getStatusBadge("" + user.status)}
                                          </div>
                                        </div>
                                      </div>

                                      {user.status === 0 && (
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                variant="outline"
                                                className="text-red-500"
                                              >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Reject
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="bg-white text-black">
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                  Are you sure?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  This will reject the
                                                  application and notify the
                                                  applicant. This action cannot
                                                  be undone.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>
                                                  Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() =>
                                                    handleRejectUser(user)
                                                  }
                                                  disabled={isUpdating}
                                                >
                                                  Reject
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>

                                          <Button
                                            disabled={isUpdating}
                                            onClick={() =>
                                              handleApproveUser(user)
                                            }
                                          >
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            Approve
                                          </Button>
                                        </div>
                                      )}
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
                                      <div className="min-w-0">
                                      <Card>
                                        <CardHeader>
                                          <CardTitle className="text-sm font-medium">
                                            User Information
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-0">
                                          <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2">
                                              <Label
                                                htmlFor={`name-${user.id}`}
                                              >
                                                Name
                                              </Label>
                                              <Input
                                                id={`name-${user.id}`}
                                                value={editForm.name}
                                                disabled={!isEditingUser}
                                                onChange={(event) =>
                                                  handleEditFormChange(
                                                    "name",
                                                    event.target.value,
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label
                                                htmlFor={`email-${user.id}`}
                                              >
                                                Email
                                              </Label>
                                              <Input
                                                id={`email-${user.id}`}
                                                type="email"
                                                value={editForm.email}
                                                disabled={!isEditingUser}
                                                onChange={(event) =>
                                                  handleEditFormChange(
                                                    "email",
                                                    event.target.value,
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label
                                                htmlFor={`callsign-${user.id}`}
                                              >
                                                Assigned Callsign
                                              </Label>
                                              <Input
                                                id={`callsign-${user.id}`}
                                                value={editForm.callsign}
                                                disabled={!isEditingUser}
                                                onChange={(event) =>
                                                  handleEditFormChange(
                                                    "callsign",
                                                    event.target.value,
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label
                                                htmlFor={`status-${user.id}`}
                                              >
                                                Status
                                              </Label>
                                              <Select
                                                value={editForm.status}
                                                disabled={!isEditingUser}
                                                onValueChange={(value) =>
                                                  handleEditFormChange(
                                                    "status",
                                                    value,
                                                  )
                                                }
                                              >
                                                <SelectTrigger
                                                  id={`status-${user.id}`}
                                                >
                                                  <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white">
                                                  <SelectItem value="0">
                                                    Pending
                                                  </SelectItem>
                                                  <SelectItem value="1">
                                                    Active
                                                  </SelectItem>
                                                  <SelectItem value="2">
                                                    Rejected
                                                  </SelectItem>
                                                  <SelectItem value="3">
                                                    Inactive
                                                  </SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>

                                          {updateError && (
                                            <p className="text-sm text-red-600">
                                              {updateError}
                                            </p>
                                          )}

                                          <div className="flex justify-end">
                                            {isEditingUser ? (
                                              <Button
                                                disabled={isUpdating}
                                                onClick={() =>
                                                  handleUpdateUser(user)
                                                }
                                              >
                                                <Save className="mr-2 h-4 w-4" />
                                                Save Changes
                                              </Button>
                                            ) : (
                                              <Button
                                                variant="outline"
                                                onClick={() =>
                                                  setIsEditingUser(true)
                                                }
                                              >
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                              </Button>
                                            )}
                                          </div>

                                          <dl className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <dt className="text-muted-foreground">
                                                IFC:
                                              </dt>
                                              <Link
                                                href={`https://community.infiniteflight.com/u/${user.ifc}/summary`}
                                              >
                                                {user.ifc || "N/A"}
                                              </Link>
                                            </div>
                                            <div className="flex justify-between">
                                              <dt className="text-muted-foreground">
                                                View Stats:
                                              </dt>
                                              <Link
                                                href={`https://www.iflytics.app/user/${user.ifc}`}
                                              >
                                                {user.ifc || "N/A"}
                                              </Link>
                                            </div>
                                            <div className="flex justify-between">
                                              <dt className="text-muted-foreground">
                                                Application Date:
                                              </dt>
                                              <dd>
                                                {new Date(
                                                  user.joined,
                                                ).toLocaleString()}
                                              </dd>
                                            </div>
                                          </dl>
                                        </CardContent>
                                      </Card>

                                      {(user.notes || user.status === 0) && (
                                        <Card className="mt-4">
                                          <CardHeader>
                                            <CardTitle className="text-sm font-medium">
                                              Admin Notes
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="space-y-4 pt-0">
                                            {user.notes && (
                                              <div className="rounded-md border bg-slate-50 p-3">
                                                <p className="mb-2 text-xs font-medium text-muted-foreground">
                                                  Saved Notes
                                                </p>
                                                <p className="text-sm">
                                                  {user.notes}
                                                </p>
                                              </div>
                                            )}

                                            {user.status === 0 && (
                                              <Textarea
                                                id="admin-notes"
                                                placeholder="Enter notes about this application..."
                                                value={adminNotes}
                                                onChange={(e) =>
                                                  setAdminNotes(e.target.value)
                                                }
                                              />
                                            )}
                                          </CardContent>
                                        </Card>
                                      )}
                                      </div>

                                      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                                      <Card>
                                        <CardHeader>
                                          <div className="flex flex-col gap-3">
                                            <div>
                                              <CardTitle className="text-sm font-medium">
                                                Application Review
                                              </CardTitle>
                                              <CardDescription>
                                                Manage exam results, Discord access,
                                                and Infinite Flight checks.
                                              </CardDescription>
                                            </div>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="w-full"
                                              disabled={isRefreshingIF}
                                              onClick={() =>
                                                refreshIFMetrics(
                                                  selectedUser || user,
                                                )
                                              }
                                            >
                                              <RefreshCw
                                                className={`mr-2 h-4 w-4 ${
                                                  isRefreshingIF
                                                    ? "animate-spin"
                                                    : ""
                                                }`}
                                              />
                                              Refresh IF
                                            </Button>
                                          </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-0">
                                          <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2">
                                              <Label
                                                htmlFor={`exam-score-${user.id}`}
                                              >
                                                Exam Score
                                              </Label>
                                              <Input
                                                id={`exam-score-${user.id}`}
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                placeholder="Score out of 100"
                                                value={applicationForm.examScore}
                                                onChange={(event) =>
                                                  handleApplicationFormChange(
                                                    "examScore",
                                                    event.target.value,
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label
                                                htmlFor={`discord-invite-${user.id}`}
                                              >
                                                Discord Invite Link
                                              </Label>
                                              <Input
                                                id={`discord-invite-${user.id}`}
                                                type="url"
                                                placeholder="https://discord.gg/..."
                                                value={
                                                  applicationForm.discordInviteUrl
                                                }
                                                onChange={(event) =>
                                                  handleApplicationFormChange(
                                                    "discordInviteUrl",
                                                    event.target.value,
                                                  )
                                                }
                                              />
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 gap-3">
                                            <div className="rounded-md border bg-slate-50 p-3">
                                              <p className="text-xs font-medium text-muted-foreground">
                                                Exam Status
                                              </p>
                                              <p className="mt-1 text-sm font-semibold">
                                                {(selectedUser || user)
                                                  .examScore !== null &&
                                                (selectedUser || user)
                                                  .examScore !== undefined
                                                  ? "Score recorded"
                                                  : (selectedUser || user)
                                                        .examStatus === 1
                                                    ? "Declared done"
                                                    : "Not recorded"}
                                              </p>
                                            </div>
                                            <div className="rounded-md border bg-slate-50 p-3">
                                              <p className="text-xs font-medium text-muted-foreground">
                                                IF Grade
                                              </p>
                                              <p className="mt-1 text-sm font-semibold">
                                                {(selectedUser || user)
                                                  .ifGrade ?? "Not available"}
                                              </p>
                                            </div>
                                            <div className="rounded-md border bg-slate-50 p-3">
                                              <p className="text-xs font-medium text-muted-foreground">
                                                IF Violations
                                              </p>
                                              <p className="mt-1 text-sm font-semibold">
                                                {(selectedUser || user)
                                                  .ifViolations ??
                                                  "Not available"}
                                              </p>
                                            </div>
                                          </div>

                                          {(selectedUser || user)
                                            .ifMetricsUpdatedAt && (
                                            <p className="text-xs text-muted-foreground">
                                              IF metrics refreshed{" "}
                                              {new Date(
                                                (selectedUser || user)
                                                  .ifMetricsUpdatedAt as string,
                                              ).toLocaleString()}
                                            </p>
                                          )}

                                          <div className="flex justify-end">
                                            <Button
                                              disabled={isUpdating}
                                              className="w-full"
                                              onClick={() =>
                                                handleUpdateApplication(
                                                  selectedUser || user,
                                                )
                                              }
                                            >
                                              <Save className="mr-2 h-4 w-4" />
                                              Save Application
                                            </Button>
                                          </div>
                                        </CardContent>
                                      </Card>

                                      </aside>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="flex items-center justify-between p-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {paginatedUsers.length} of {filteredUsers.length}{" "}
                    users
                  </div>

                  {totalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage((prev) => Math.max(prev - 1, 1));
                            }}
                            aria-disabled={currentPage === 1}
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : ""
                            }
                          />
                        </PaginationItem>

                        {Array.from({ length: totalPages }).map((_, i) => {
                          const page = i + 1;
                          // Show first page, last page, and pages around current page
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setCurrentPage(page);
                                  }}
                                  isActive={page === currentPage}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }

                          // Show ellipsis for gaps
                          if (
                            (page === 2 && currentPage > 3) ||
                            (page === totalPages - 1 &&
                              currentPage < totalPages - 2)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }

                          return null;
                        })}

                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage((prev) =>
                                Math.min(prev + 1, totalPages),
                              );
                            }}
                            aria-disabled={currentPage === totalPages}
                            className={
                              currentPage === totalPages
                                ? "pointer-events-none opacity-50"
                                : ""
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </CardFooter>
              </Card>
            </div>
          </Tabs>
        </div>
      </main>
    </CrewHeader>
  );
}
