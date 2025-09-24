"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Calendar,
  Clock,
  Eye,
  FileText,
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

// Mock data for applications
const applicationsData = [
  {
    id: "APP-1001",
    name: "Michael Johnson",
    email: "michael.johnson@example.com",
    dateOfBirth: "1990-05-15",
    submittedAt: "2023-03-15T18:30:00Z",
    status: "Pending",
    experience:
      "I have 500+ hours in X-Plane and have been flight simming for 5 years. I'm familiar with VATSIM procedures and have completed several online flights.",
    reason:
      "I'm looking to join a virtual airline to enhance my flight simulation experience and be part of a community of like-minded aviation enthusiasts.",
    preferredAircraft: ["B738", "A320"],
    availability: "Weekends and evenings (EST)",
    vatsimId: "1234567",
    ivaoId: null,
    discordUsername: "mjohnson#1234",
    referredBy: null,
    adminNotes: null,
    processedAt: null,
    processedBy: null,
  },
  {
    id: "APP-1002",
    name: "Sarah Williams",
    email: "sarah.williams@example.com",
    dateOfBirth: "1988-10-22",
    submittedAt: "2023-03-10T14:45:00Z",
    status: "Approved",
    experience:
      "I've been flight simming for over 10 years, primarily with MSFS and P3D. I have experience with both IFR and VFR flights and am comfortable with complex aircraft systems.",
    reason:
      "I'm looking for a structured environment to improve my skills and enjoy flying with others who share my passion for aviation.",
    preferredAircraft: ["B77W", "A359"],
    availability: "Most weekdays and weekends (PST)",
    vatsimId: "7654321",
    ivaoId: "IVA123456",
    discordUsername: "sarahw#5678",
    referredBy: "John Doe",
    adminNotes:
      "Excellent application with extensive experience. Approved for immediate onboarding.",
    processedAt: "2023-03-12T09:30:00Z",
    processedBy: "Admin User",
  },
  {
    id: "APP-1003",
    name: "David Brown",
    email: "david.brown@example.com",
    dateOfBirth: "1995-03-30",
    submittedAt: "2023-03-05T11:20:00Z",
    status: "Rejected",
    experience:
      "I'm new to flight simulation but have been interested in aviation for years. I've completed the basic training in MSFS.",
    reason:
      "I want to learn more about aviation and improve my skills in a supportive environment.",
    preferredAircraft: ["CRJ7", "E190"],
    availability: "Evenings (GMT)",
    vatsimId: null,
    ivaoId: null,
    discordUsername: "dbrown#9012",
    referredBy: null,
    adminNotes:
      "Insufficient experience for our requirements. Suggested to gain more experience and reapply in 3 months.",
    processedAt: "2023-03-07T16:15:00Z",
    processedBy: "Admin User",
  },
  {
    id: "APP-1004",
    name: "Jennifer Lee",
    email: "jennifer.lee@example.com",
    dateOfBirth: "1992-12-10",
    submittedAt: "2023-02-28T20:10:00Z",
    status: "Pending",
    experience:
      "I have 3 years of experience with X-Plane and MSFS. I'm familiar with Boeing aircraft systems and have completed several long-haul flights.",
    reason:
      "I'm looking for a community that focuses on realistic operations and provides opportunities for growth.",
    preferredAircraft: ["B738", "B77W"],
    availability: "Weekends (AEST)",
    vatsimId: "2345678",
    ivaoId: null,
    discordUsername: "jlee#3456",
    referredBy: "Sarah Williams",
    adminNotes: null,
    processedAt: null,
    processedBy: null,
  },
  {
    id: "APP-1005",
    name: "Robert Garcia",
    email: "robert.garcia@example.com",
    dateOfBirth: "1985-08-05",
    submittedAt: "2023-02-25T15:30:00Z",
    status: "Approved",
    experience:
      "I'm a real-world private pilot with 200+ hours and have been using flight simulators for training and enjoyment for over 15 years.",
    reason:
      "I want to join a virtual airline that values realism and proper procedures, similar to real-world operations.",
    preferredAircraft: ["A320", "B738"],
    availability: "Flexible schedule (CST)",
    vatsimId: "3456789",
    ivaoId: "IVA234567",
    discordUsername: "rgarcia#7890",
    referredBy: null,
    adminNotes:
      "Real-world pilot experience is a great asset. Fast-tracked approval.",
    processedAt: "2023-02-26T10:45:00Z",
    processedBy: "Admin User",
  },
];

export default function AdminApplications() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateSort, setDateSort] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<
    (typeof applicationsData)[0] | null
  >(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [adminNotes, setAdminNotes] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const itemsPerPage = 5;

  // Filter applications based on search, filters, and active tab
  const filteredApplications = applicationsData.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.discordUsername &&
        app.discordUsername.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all"
        ? true
        : app.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesTab =
      activeTab === "all"
        ? true
        : app.status.toLowerCase() === activeTab.toLowerCase();

    return matchesSearch && matchesStatus && matchesTab;
  });

  // Sort applications by date
  const sortedApplications = [...filteredApplications].sort((a, b) => {
    const dateA = new Date(a.submittedAt).getTime();
    const dateB = new Date(b.submittedAt).getTime();
    return dateSort === "desc" ? dateB - dateA : dateA - dateB;
  });

  // Paginate applications
  const totalPages = Math.ceil(sortedApplications.length / itemsPerPage);
  const paginatedApplications = sortedApplications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "pending":
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  // Handle application approval
  const handleApproveApplication = (
    application: (typeof applicationsData)[0]
  ) => {
    // In a real app, you would call an API to update the application status
    console.log(
      `Approving application ${application.id} with notes: ${adminNotes}`
    );
    // Reset admin notes
    setAdminNotes("");
  };

  // Handle application rejection
  const handleRejectApplication = (
    application: (typeof applicationsData)[0]
  ) => {
    // In a real app, you would call an API to update the application status
    console.log(
      `Rejecting application ${application.id} with notes: ${adminNotes}`
    );
    // Reset admin notes
    setAdminNotes("");
  };

  // Count applications by status
  const pendingCount = applicationsData.filter(
    (app) => app.status.toLowerCase() === "pending"
  ).length;
  const approvedCount = applicationsData.filter(
    (app) => app.status.toLowerCase() === "approved"
  ).length;
  const rejectedCount = applicationsData.filter(
    (app) => app.status.toLowerCase() === "rejected"
  ).length;

  return (
    <CrewHeader>
      <main className="flex-1 ">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">User Applications</h1>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/admin/application-settings">
                  <Clock className="mr-2 h-4 w-4" />
                  <span>Application Settings</span>
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/admin/application-export">
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Export Applications</span>
                </a>
              </Button>
            </div>
          </div>

          <Tabs
            defaultValue="all"
            className="space-y-4"
            onValueChange={setActiveTab}
          >
            <div className="flex justify-between">
              <TabsList>
                <TabsTrigger value="all" className="relative">
                  All
                  <Badge className="ml-2 bg-primary/10 text-primary">
                    {applicationsData.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="relative">
                  Pending
                  <Badge className="ml-2 bg-amber-100 text-amber-700">
                    {pendingCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="approved" className="relative">
                  Approved
                  <Badge className="ml-2 bg-green-100 text-green-700">
                    {approvedCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="rejected" className="relative">
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
                  <ChevronDown
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
                  <Label htmlFor="search">Search Applications</Label>
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
                    <ChevronDown
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
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              <TabsContent value="all" className="m-0">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle>All Applications</CardTitle>
                    <CardDescription>
                      View and manage all user applications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Application ID</TableHead>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead className="hidden md:table-cell">
                            Discord
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Preferred Aircraft
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedApplications.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-center py-8 text-muted-foreground"
                            >
                              No applications found matching your criteria
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedApplications.map((application) => (
                            <TableRow key={application.id}>
                              <TableCell className="font-medium">
                                {application.id}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span>{application.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {application.email}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {new Date(
                                  application.submittedAt
                                ).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {application.discordUsername || "N/A"}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {application.preferredAircraft.join(", ")}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(application.status)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setSelectedApplication(application)
                                      }
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      <span className="hidden sm:inline">
                                        View
                                      </span>
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        {getStatusIcon(application.status)}
                                        <span>
                                          Application Details: {application.id}
                                        </span>
                                      </DialogTitle>
                                      <DialogDescription>
                                        Submitted on{" "}
                                        {new Date(
                                          application.submittedAt
                                        ).toLocaleString()}
                                      </DialogDescription>
                                    </DialogHeader>

                                    <div className="grid gap-4 py-4">
                                      <div className="flex items-center gap-4">
                                        <Avatar className="h-16 w-16">
                                          <AvatarFallback>
                                            {application.name.charAt(0)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <h3 className="text-lg font-semibold">
                                            {application.name}
                                          </h3>
                                          <p className="text-sm text-muted-foreground">
                                            {application.email}
                                          </p>
                                          <div className="mt-1">
                                            {getStatusBadge(application.status)}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card>
                                          <CardHeader className="p-3">
                                            <CardTitle className="text-sm font-medium">
                                              Personal Information
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-3 pt-0">
                                            <dl className="space-y-2 text-sm">
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Name:
                                                </dt>
                                                <dd>{application.name}</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Email:
                                                </dt>
                                                <dd>{application.email}</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Date of Birth:
                                                </dt>
                                                <dd>
                                                  {application.dateOfBirth}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Discord:
                                                </dt>
                                                <dd>
                                                  {application.discordUsername ||
                                                    "N/A"}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  VATSIM ID:
                                                </dt>
                                                <dd>
                                                  {application.vatsimId ||
                                                    "N/A"}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  IVAO ID:
                                                </dt>
                                                <dd>
                                                  {application.ivaoId || "N/A"}
                                                </dd>
                                              </div>
                                            </dl>
                                          </CardContent>
                                        </Card>

                                        <Card>
                                          <CardHeader className="p-3">
                                            <CardTitle className="text-sm font-medium">
                                              Application Details
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-3 pt-0">
                                            <dl className="space-y-2 text-sm">
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Submitted:
                                                </dt>
                                                <dd>
                                                  {new Date(
                                                    application.submittedAt
                                                  ).toLocaleString()}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Status:
                                                </dt>
                                                <dd>
                                                  {getStatusBadge(
                                                    application.status
                                                  )}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Preferred Aircraft:
                                                </dt>
                                                <dd>
                                                  {application.preferredAircraft.join(
                                                    ", "
                                                  )}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Availability:
                                                </dt>
                                                <dd>
                                                  {application.availability}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Referred By:
                                                </dt>
                                                <dd>
                                                  {application.referredBy ||
                                                    "N/A"}
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
                                        <AccordionItem value="experience">
                                          <AccordionTrigger>
                                            Experience
                                          </AccordionTrigger>
                                          <AccordionContent>
                                            <p className="text-sm">
                                              {application.experience}
                                            </p>
                                          </AccordionContent>
                                        </AccordionItem>

                                        <AccordionItem value="reason">
                                          <AccordionTrigger>
                                            Reason for Applying
                                          </AccordionTrigger>
                                          <AccordionContent>
                                            <p className="text-sm">
                                              {application.reason}
                                            </p>
                                          </AccordionContent>
                                        </AccordionItem>

                                        {application.adminNotes && (
                                          <AccordionItem value="admin-notes">
                                            <AccordionTrigger>
                                              Admin Notes
                                            </AccordionTrigger>
                                            <AccordionContent>
                                              <p className="text-sm">
                                                {application.adminNotes}
                                              </p>
                                            </AccordionContent>
                                          </AccordionItem>
                                        )}
                                      </Accordion>

                                      {application.status === "Pending" && (
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

                                          <div className="flex justify-end gap-2 mt-4">
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button variant="destructive">
                                                  <XCircle className="mr-2 h-4 w-4" />
                                                  Reject Application
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>
                                                    Are you sure?
                                                  </AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This will reject the
                                                    application and notify the
                                                    applicant. This action
                                                    cannot be undone.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>
                                                    Cancel
                                                  </AlertDialogCancel>
                                                  <AlertDialogAction
                                                    onClick={() =>
                                                      handleRejectApplication(
                                                        application
                                                      )
                                                    }
                                                  >
                                                    Reject
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>

                                            <Button
                                              onClick={() =>
                                                handleApproveApplication(
                                                  application
                                                )
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
                      Showing {paginatedApplications.length} of{" "}
                      {filteredApplications.length} applications
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
                              (page >= currentPage - 1 &&
                                page <= currentPage + 1)
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
                                  Math.min(prev + 1, totalPages)
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
              </TabsContent>

              <TabsContent value="pending" className="m-0">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle>Pending Applications</CardTitle>
                    <CardDescription>
                      Review and process pending user applications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Same table structure as "all" tab but filtered for pending applications */}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between p-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {paginatedApplications.length} of{" "}
                      {filteredApplications.length} applications
                    </div>

                    {/* Same pagination as in "all" tab */}
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="approved" className="m-0">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle>Approved Applications</CardTitle>
                    <CardDescription>
                      View all approved user applications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Same table structure as "all" tab but filtered for approved applications */}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between p-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {paginatedApplications.length} of{" "}
                      {filteredApplications.length} applications
                    </div>

                    {/* Same pagination as in "all" tab */}
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="rejected" className="m-0">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle>Rejected Applications</CardTitle>
                    <CardDescription>
                      View all rejected user applications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Same table structure as "all" tab but filtered for rejected applications */}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between p-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {paginatedApplications.length} of{" "}
                      {filteredApplications.length} applications
                    </div>

                    {/* Same pagination as in "all" tab */}
                  </CardFooter>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </CrewHeader>
  );
}
