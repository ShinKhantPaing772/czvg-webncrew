import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function OperationsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Operations</h1>
            <div className="max-w-3xl">
              <p className="text-lg text-gray-600 mb-8">
                Explore our fleet, routes network, and operational hubs across
                China and beyond.
              </p>
            </div>
          </div>
        </section>

        {/* Operations Overview */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">Our Operations</h2>
              <div className="prose prose-lg">
                <p>
                  China Southern Virtual Group operates one of the most
                  extensive networks in the virtual aviation community. With
                  over 300 destinations and 1000+ routes, we provide virtual
                  pilots with endless flying opportunities.
                </p>
                <p>
                  Our operations are centered around our main hubs at Guangzhou
                  Baiyun International Airport and Beijing Daxing International
                  Airport, with additional focus cities throughout China and
                  Asia.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Operations Cards */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Fleet Card */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden border hover:shadow-lg transition-shadow">
                  <div className="h-48 relative">
                    <Image
                      src="/placeholder.svg?height=400&width=600"
                      alt="Aircraft fleet"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold mb-3">Our Fleet</h3>
                    <p className="text-gray-600 mb-4">
                      Explore our diverse fleet of aircraft, from regional jets
                      to wide-body airliners.
                    </p>
                    <Link
                      href="/operations/fleet"
                      className="text-blue-700 font-medium hover:underline inline-flex items-center"
                    >
                      View Fleet
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>

                {/* Routes Card */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden border hover:shadow-lg transition-shadow">
                  <div className="h-48 relative">
                    <Image
                      src="/placeholder.svg?height=400&width=600"
                      alt="Route map"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold mb-3">Our Routes</h3>
                    <p className="text-gray-600 mb-4">
                      Discover our global network of destinations and plan your
                      next virtual flight.
                    </p>
                    <Link
                      href="/operations/routes"
                      className="text-blue-700 font-medium hover:underline inline-flex items-center"
                    >
                      Explore Routes
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>

                {/* Hubs Card */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden border hover:shadow-lg transition-shadow">
                  <div className="h-48 relative">
                    <Image
                      src="/placeholder.svg?height=400&width=600"
                      alt="Airport hub"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold mb-3">Our Hubs</h3>
                    <p className="text-gray-600 mb-4">
                      Learn about our main operational hubs and focus cities
                      across China.
                    </p>
                    <Link
                      href="/operations/hubs"
                      className="text-blue-700 font-medium hover:underline inline-flex items-center"
                    >
                      View Hubs
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-blue-700 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Start Flying?
              </h2>
              <p className="text-xl mb-8">
                Join our virtual airline group today and experience the thrill
                of flying with China Southern.
              </p>
              <Link
                href="/join-us"
                className="bg-white text-blue-700 px-6 py-3 rounded font-medium hover:bg-gray-100 transition-colors"
              >
                Apply Now
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
