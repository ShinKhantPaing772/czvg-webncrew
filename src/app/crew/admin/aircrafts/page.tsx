// Next.js App Router structure
// File: app/aircraft/page.tsx
"use client";
import { useEffect, useState } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Edit } from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CrewHeader } from "@/components/crew-header";
import { Card, CardContent } from "@/components/ui/card";

interface Aircraft {
  id: number;
  name: string;
  liveryname: string;
  notes: string;
  rankreq: string;
  awardreq: string;
  ifAircraftId: string;
  ifLiveryId: string;
}

interface IfAircraft {
  id: string;
  name: string;
}

interface IfLivery {
  id: string;
  liveryName: string;
}

export default function AircraftPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [open, setOpen] = useState(false);
  const [ifAircraftList, setIfAircraftList] = useState<IfAircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [ifLiveryList, setIfLiveryList] = useState<IfLivery[]>([]);
  const [isloadingaircraft, setIsloadingaircraft] = useState(false);
  const [isloadingaircraftif, setIsloadingaircraftif] = useState(false);
  const [isloadingliveryif, setIsloadingliveryif] = useState(false);
  const [isloading, setIsloading] = useState(false);
  const [form, setForm] = useState({
    notes: "",
    rankReq: 3,
    awardReq: "",
    ifAircraftName: "",
    ifAircraftId: "",
    ifLiveryName: "",
    ifLiveryId: "",
  });

  const fetchAircraft = async () => {
    setIsloadingaircraft(true);
    const res = await fetch("/api/aircraft");
    const data = await res.json();
    setAircraft(data.aircrafts);
    setIsloadingaircraft(false);
  };

  useEffect(() => {
    fetchAircraft();
  }, []);

  const openAddModal = async () => {
    setOpen(true);
    setIsloadingaircraftif(true);
    const res = await fetch("/api/aircraft/if/aircraft");
    const data = await res.json();
    setIfAircraftList(data.result);
    setIsloadingaircraftif(false);
  };

  const handleSelectAircraft = async (id: string) => {
    const aircraftObj = ifAircraftList.find((a) => a.id === id);

    setSelectedAircraft(id as any);

    setForm({
      ...form,
      ifAircraftId: id,
      ifAircraftName: aircraftObj?.name || "",
    });

    setIsloadingliveryif(true);
    const res = await fetch(`/api/aircraft/if/liveries/${id}`);
    const data = await res.json();
    setIfLiveryList(data.result);
    setIsloadingliveryif(false);
  };

  const handleSubmit = async () => {
    if (!form.ifAircraftId || !form.ifLiveryId) return;
    setIsloading(true);
    const res = await fetch("/api/aircraft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    console.log("API response:", data);
    if (res.ok) {
      setIsloading(false);
      setOpen(false);
      fetchAircraft();
      //reset form values
      setForm({
        notes: "",
        rankReq: 3,
        awardReq: "",
        ifAircraftName: "",
        ifAircraftId: "",
        ifLiveryName: "",
        ifLiveryId: "",
      });
    }
  };

  const canSubmit =
    form.ifAircraftId.trim() !== "" && form.ifLiveryId.trim() !== "";

  return (
    <CrewHeader>
      <main className="flex-1 ">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">Aircrafts</h1>
            <Button onClick={openAddModal}>
              <Plus className="mr-2" /> Add Aircraft
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {" "}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Livery</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Rank Req</TableHead>
                    <TableHead>Award Req</TableHead>
                    <TableHead>Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isloadingaircraft ? (
                    <TableRow>
                      <TableCell colSpan={6}>Loading...</TableCell>
                    </TableRow>
                  ) : (
                    aircraft.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.name}</TableCell>
                        <TableCell>{a.liveryname}</TableCell>
                        <TableCell>{a.notes}</TableCell>
                        <TableCell>{a.rankreq}</TableCell>
                        <TableCell>{a.awardreq}</TableCell>
                        <TableCell>
                          <Button size="sm" disabled={true}>
                            <Edit />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Add Aircraft Modal */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Add Aircraft</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div>
                  <p>Select Aircraft</p>
                  <Select
                    onValueChange={handleSelectAircraft}
                    disabled={isloadingaircraftif}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose aircraft" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-[200px] overflow-y-auto">
                      {ifAircraftList.map((a) => (
                        <SelectItem
                          value={(a as { id: string; name: string }).id}
                          key={(a as { id: string; name: string }).id}
                        >
                          {(a as { id: string; name: string }).name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAircraft && (
                  <div>
                    <p>Select Livery</p>
                    <Select
                      onValueChange={(v) => {
                        const liveryObj = ifLiveryList.find(
                          (l: { id: string; liveryName: string }) => l.id === v,
                        );

                        setForm({
                          ...form,
                          ifLiveryId: v,
                          ifLiveryName: liveryObj?.liveryName || "",
                        });
                      }}
                      disabled={isloadingliveryif}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose livery" />
                      </SelectTrigger>
                      <SelectContent className="bg-white max-h-[200px] overflow-y-auto">
                        {ifLiveryList.map((l) => (
                          <SelectItem
                            value={(l as { id: string; liveryName: string }).id}
                            key={(l as { id: string; liveryName: string }).id}
                          >
                            {
                              (l as { id: string; liveryName: string })
                                .liveryName
                            }
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Input
                  placeholder="Notes"
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
                <Input
                  placeholder="3"
                  disabled={true}
                  onChange={(e) =>
                    setForm({ ...form, rankReq: Number(e.target.value) })
                  }
                />
                <Input
                  placeholder="Award Required"
                  disabled={true}
                  onChange={(e) =>
                    setForm({ ...form, awardReq: e.target.value })
                  }
                />

                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isloading}
                >
                  Add
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </CrewHeader>
  );
}
