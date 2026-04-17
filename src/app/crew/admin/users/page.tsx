"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Calendar,
  Eye,
  FileText,
  ArrowDown,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

interface Pilots {
  id: string;
  name: string;
  callsign: string;
  ifc: string;
  email: string;
  joined: Date;
  lastActivity?: string | null;
  status: Number;
  notes: string | null;
  transhours: Number;
  transflights: Number;
}

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
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchusers = async () => {
      try {
        const response = await fetch("/api/admin/users");
        const data = await response.json();
        // Make sure it’s an array
        const usersArray = Array.isArray(data) ? data : data.users || [];
        setUsers(usersArray);
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

  // Handle application approval
  const handleApproveUser = async (user: Pilots) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/users", {
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
        // Refresh users list
        const response = await fetch("/api/admin/users");
        const data = await response.json();
        // Make sure it’s an array
        const usersArray = Array.isArray(data) ? data : data.users || [];
        setUsers(usersArray);
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
      const response = await fetch("/api/admin/users", {
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
        // Refresh users list
        const response = await fetch("/api/admin/users");
        const data = await response.json();
        // Make sure it’s an array
        const usersArray = Array.isArray(data) ? data : data.users || [];
        setUsers(usersArray);
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
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedUser(user)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">
                                      View
                                    </span>
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl bg-white">
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

                                    <div className="grid grid-cols-1 gap-4">
                                      <Card>
                                        <CardHeader>
                                          <CardTitle className="text-sm font-medium">
                                            User Information
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className=" pt-0">
                                          <dl className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <dt className="text-muted-foreground">
                                                Name:
                                              </dt>
                                              <dd>{user.name}</dd>
                                            </div>
                                            <div className="flex justify-between">
                                              <dt className="text-muted-foreground">
                                                Email:
                                              </dt>
                                              <dd>{user.email}</dd>
                                            </div>
                                            <div className="flex justify-between">
                                              <dt className="text-muted-foreground">
                                                Assigned Callsign:
                                              </dt>
                                              <dd>{user.callsign}</dd>
                                            </div>
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
                                    </div>

                                    <Accordion
                                      type="single"
                                      collapsible
                                      className="w-full"
                                    >
                                      {user.notes && (
                                        <AccordionItem value="admin-notes">
                                          <AccordionTrigger>
                                            Admin Notes
                                          </AccordionTrigger>
                                          <AccordionContent>
                                            <p className="text-sm">
                                              {user.notes}
                                            </p>
                                          </AccordionContent>
                                        </AccordionItem>
                                      )}
                                    </Accordion>

                                    {user.status === 0 && (
                                      <div className="space-y-2">
                                        <Label htmlFor="admin-notes">
                                          Admin Notes
                                        </Label>
                                        <Textarea
                                          id="admin-notes"
                                          placeholder="Enter notes about this application..."
                                          value={adminNotes}
                                          onChange={(e) =>
                                            setAdminNotes(e.target.value)
                                          }
                                        />

                                        <div className="flex justify-between gap-5 mt-4">
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                variant="outline"
                                                className="text-red-500"
                                              >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Reject Application
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
                                            Approve Application
                                          </Button>
                                        </div>
                                      </div>
                                    )}
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
