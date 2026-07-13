"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrewHeader } from "@/components/crew-header";
import { authFetch } from "@/lib/utils/api";

interface Aircraft {
  id: number;
  name: string;
  liveryname: string;
  notes?: string;
}

interface Route {
  id: number;
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
  notes: string;
  aircraft: Aircraft[];
}

export default function EditRoutePage() {
  const router = useRouter();
  const { id } = useParams();
  const [routeData, setRouteData] = useState<Route | null>(null);
  const [aircraftOptions, setAircraftOptions] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredAircraft, setFilteredAircraft] = useState<Aircraft[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFilteredAircraft(aircraftOptions);
  }, [aircraftOptions]);

  // Fetch route details
  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const res = await authFetch(`/api/admin/routes/${id}`);
        if (!res.ok) throw new Error("Failed to fetch route");
        const data = await res.json();
        setRouteData(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const fetchAircraft = async () => {
      const res = await authFetch("/api/aircraft");
      const data = await res.json();
      setAircraftOptions(data.aircrafts);
    };

    fetchRoute();
    fetchAircraft();
  }, [id]);

  const handleSave = async () => {
    if (!routeData) return;

    setSaving(true);
    try {
      const res = await authFetch("/api/admin/routes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: routeData.id,
          fltnum: routeData.fltnum,
          dep: routeData.dep,
          arr: routeData.arr,
          duration: routeData.duration,
          notes: routeData.notes,
          aircraft: routeData.aircraft.map((a) => a.id),
        }),
      });

      if (!res.ok) throw new Error("Failed to update route");

      alert("Route updated successfully!");
      router.push("/crew/admin/routes");
    } catch (err) {
      console.error(err);
      alert("Error updating route.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <CrewHeader>
        <div className="max-w-3xl mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <p className="p-8 text-center text-black">Loading...</p>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </CrewHeader>
    );
  if (!routeData)
    return (
      <CrewHeader>
        <div className="max-w-3xl mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <p className="p-8 text-center text-red-500">Route not found</p>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </CrewHeader>
    );

  return (
    <CrewHeader>
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Edit Route — {routeData.fltnum}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Flight Number</Label>
                <Input
                  value={routeData.fltnum}
                  onChange={(e) =>
                    setRouteData({ ...routeData, fltnum: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Duration (HH:MM)</Label>
                <Input
                  placeholder="01:30"
                  value={routeData.duration}
                  onChange={(e) =>
                    setRouteData({ ...routeData, duration: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Departure Airport</Label>
                <Input
                  value={routeData.dep}
                  maxLength={4}
                  onChange={(e) =>
                    setRouteData({
                      ...routeData,
                      dep: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>

              <div>
                <Label>Arrival Airport</Label>
                <Input
                  value={routeData.arr}
                  maxLength={4}
                  onChange={(e) =>
                    setRouteData({
                      ...routeData,
                      arr: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Aircraft</Label>
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
                  <Select
                    onValueChange={(value) => {
                      const ac = aircraftOptions.find(
                        (a) => a.id.toString() === value,
                      );
                      if (
                        ac &&
                        !routeData.aircraft.some((a) => a.id === ac.id)
                      ) {
                        setRouteData({
                          ...routeData,
                          aircraft: [...routeData.aircraft, ac],
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select aircraft..." />
                    </SelectTrigger>

                    <SelectContent className="bg-white max-h-[200px] overflow-y-auto">
                      {isSearching ? (
                        <div className="flex items-center justify-center h-10">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        filteredAircraft.map((ac) => (
                          <SelectItem key={ac.id} value={ac.id.toString()}>
                            {ac.name} - {ac.liveryname}
                            {ac.notes && (
                              <span className="text-xs text-muted-foreground block">
                                Notes: {ac.notes}
                              </span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Search aircraft..."
                    className="w-full"
                    onChange={(e) => {
                      const term = e.target.value.toLowerCase();
                      setIsSearching(true);
                      setTimeout(() => {
                        const filtered = aircraftOptions.filter(
                          (a) =>
                            a.name.toLowerCase().includes(term) ||
                            a.liveryname.toLowerCase().includes(term),
                        );
                        setFilteredAircraft(filtered);
                        setIsSearching(false);
                      }, 150);
                    }}
                  />
                </div>

                {/* Selected aircraft badges */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {routeData.aircraft.map((a) => (
                    <Badge
                      key={a.id}
                      variant="secondary"
                      className="flex items-center space-x-1"
                    >
                      <span>
                        {a.name} - {a.liveryname}
                      </span>
                      <button
                        className="text-xs font-bold hover:text-red-500"
                        onClick={() =>
                          setRouteData({
                            ...routeData,
                            aircraft: routeData.aircraft.filter(
                              (x) => x.id !== a.id,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={routeData.notes}
                onChange={(e) =>
                  setRouteData({ ...routeData, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/crew/admin/routes")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </CrewHeader>
  );
}
