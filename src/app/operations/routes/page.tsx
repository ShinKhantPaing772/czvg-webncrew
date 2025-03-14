import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function RoutesPage() {
  // Sample routes data
  const routeCategories = [
    {
      category: "Domestic Routes",
      description:
        "Our extensive domestic network connects all major cities across China.",
      routes: [
        {
          from: "Guangzhou (CAN)",
          to: "Beijing (PEK)",
          distance: "1,880 km",
          duration: "3h 10m",
          frequency: "Multiple daily",
          aircraft: ["Boeing 777-300ER", "Airbus A330-300", "Boeing 787-9"],
        },
        {
          from: "Guangzhou (CAN)",
          to: "Shanghai (PVG)",
          distance: "1,300 km",
          duration: "2h 20m",
          frequency: "Multiple daily",
          aircraft: ["Airbus A320neo", "Boeing 737-800"],
        },
        {
          from: "Beijing (PEK)",
          to: "Shenzhen (SZX)",
          distance: "1,950 km",
          duration: "3h 25m",
          frequency: "Daily",
          aircraft: ["Airbus A330-300", "Boeing 787-9"],
        },
        {
          from: "Shanghai (PVG)",
          to: "Chengdu (CTU)",
          distance: "1,670 km",
          duration: "2h 55m",
          frequency: "Daily",
          aircraft: ["Airbus A320neo", "Boeing 737-800"],
        },
      ],
    },
    {
      category: "International Routes - Asia",
      description: "Connecting China with major destinations across Asia.",
      routes: [
        {
          from: "Guangzhou (CAN)",
          to: "Tokyo (NRT)",
          distance: "3,050 km",
          duration: "4h 10m",
          frequency: "Daily",
          aircraft: ["Airbus A330-300", "Boeing 787-9"],
        },
        {
          from: "Beijing (PEK)",
          to: "Seoul (ICN)",
          distance: "950 km",
          duration: "2h 05m",
          frequency: "Daily",
          aircraft: ["Airbus A330-300", "Boeing 737-800"],
        },
        {
          from: "Guangzhou (CAN)",
          to: "Singapore (SIN)",
          distance: "2,380 km",
          duration: "3h 45m",
          frequency: "Daily",
          aircraft: ["Airbus A330-300", "Boeing 787-9"],
        },
      ],
    },
    {
      category: "International Routes - Long Haul",
      description:
        "Our long-haul services connecting China with Europe, North America, and Australia.",
      routes: [
        {
          from: "Guangzhou (CAN)",
          to: "Los Angeles (LAX)",
          distance: "11,800 km",
          duration: "13h 20m",
          frequency: "Daily",
          aircraft: ["Boeing 777-300ER", "Boeing 787-9"],
        },
        {
          from: "Beijing (PEK)",
          to: "London (LHR)",
          distance: "8,150 km",
          duration: "10h 30m",
          frequency: "Daily",
          aircraft: ["Boeing 777-300ER", "Airbus A350-900"],
        },
        {
          from: "Guangzhou (CAN)",
          to: "Sydney (SYD)",
          distance: "7,400 km",
          duration: "9h 15m",
          frequency: "Daily",
          aircraft: ["Airbus A350-900", "Boeing 787-9"],
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Link href="/" className="hover:text-blue-700">
                Home
              </Link>
              <span>/</span>
              <Link href="/operations" className="hover:text-blue-700">
                Operations
              </Link>
              <span>/</span>
              <span className="text-gray-700">Routes</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Our Routes</h1>
            <div className="max-w-3xl">
              <p className="text-lg text-gray-600 mb-8">
                Discover our global network of destinations and plan your next
                virtual flight.
              </p>
            </div>
          </div>
        </section>

        {/* Route Map */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">Route Network</h2>
              <div className="prose prose-lg mb-8">
                <p>
                  China Southern Virtual Group operates one of the most
                  extensive networks in the virtual aviation community, with
                  over 300 destinations and 1000+ routes across China and around
                  the world.
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="aspect-[16/9] relative">
                  <Image
                    src="/placeholder.svg?height=720&width=1280"
                    alt="Route map"
                    fill
                    className="object-cover rounded"
                  />
                </div>
                <p className="text-center text-sm text-gray-500 mt-2">
                  China Southern Virtual Group Route Network
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Route Categories */}
        {routeCategories.map((category, categoryIndex) => (
          <section key={categoryIndex} className="py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold mb-4">{category.category}</h2>
                <p className="text-lg text-gray-600 mb-8">
                  {category.description}
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-4 py-3 text-left">Route</th>
                        <th className="border px-4 py-3 text-left">Distance</th>
                        <th className="border px-4 py-3 text-left">Duration</th>
                        <th className="border px-4 py-3 text-left">
                          Frequency
                        </th>
                        <th className="border px-4 py-3 text-left">Aircraft</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.routes.map((route, routeIndex) => (
                        <tr
                          key={routeIndex}
                          className={
                            routeIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          <td className="border px-4 py-3">
                            <div className="font-medium">
                              {route.from} to {route.to}
                            </div>
                          </td>
                          <td className="border px-4 py-3">{route.distance}</td>
                          <td className="border px-4 py-3">{route.duration}</td>
                          <td className="border px-4 py-3">
                            {route.frequency}
                          </td>
                          <td className="border px-4 py-3">
                            <ul className="list-disc list-inside">
                              {route.aircraft.map((aircraft, aircraftIndex) => (
                                <li key={aircraftIndex} className="text-sm">
                                  {aircraft}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* CTA Section */}
        <section className="py-16 bg-blue-700 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Explore Our Routes?
              </h2>
              <p className="text-xl mb-8">
                Join our virtual airline group today and fly to destinations
                around the world.
              </p>
              <div className="flex justify-center space-x-4">
                <Link
                  href="/join-us"
                  className="bg-white text-blue-700 px-6 py-3 rounded font-medium hover:bg-gray-100 transition-colors"
                >
                  Apply Now
                </Link>
                <Link
                  href="/operations/fleet"
                  className="border border-white px-6 py-3 rounded font-medium hover:bg-blue-600 transition-colors"
                >
                  View Our Fleet
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
