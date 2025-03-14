import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">About Us</h1>
            <div className="max-w-3xl">
              <p className="text-lg text-gray-600 mb-8">
                Learn about our history, mission, and the airlines we operate.
              </p>
            </div>
          </div>
        </section>

        {/* Background Section */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">
                China Southern's Background
              </h2>
              <div className="prose prose-lg">
                <p>
                  Founded in July 2021, China Southern Virtual Group was
                  established when the idea of bringing another China-based
                  airline to Infinite Flight started. Our hubs are at Guangzhou
                  Baiyun and Beijing Daxing.
                </p>
                <p>
                  As one of the largest airlines in China, we fly to more than
                  300+ destinations across 1000+ routes from our hubs and focus
                  cities to many places around the world. We also have a large
                  variety of fleets you can fly!
                </p>
                <p className="font-medium">
                  Come and join China Southern Virtual Group to Fly Into Your
                  Dreams.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Airlines We Operate */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-8">Airlines We Operate</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    name: "China Southern Airlines",
                    logo: "/placeholder.svg?height=80&width=160",
                    description:
                      "Our flagship carrier with extensive domestic and international routes.",
                  },
                  {
                    name: "Xiamen Air",
                    logo: "/placeholder.svg?height=80&width=160",
                    description:
                      "Based in Xiamen, serving destinations across Asia and beyond.",
                  },
                  {
                    name: "Chengdu Air",
                    logo: "/placeholder.svg?height=80&width=160",
                    description:
                      "Focused on routes from Chengdu to major Chinese cities.",
                  },
                  {
                    name: "Hebei Air",
                    logo: "/placeholder.svg?height=80&width=160",
                    description:
                      "Connecting Hebei province with destinations across China.",
                  },
                  {
                    name: "Jiangxi Air",
                    logo: "/placeholder.svg?height=80&width=160",
                    description:
                      "Serving routes from Nanchang to major Chinese destinations.",
                  },
                  {
                    name: "Chongqing Air",
                    logo: "/placeholder.svg?height=80&width=160",
                    description:
                      "Operating from Chongqing to cities throughout China.",
                  },
                ].map((airline, index) => (
                  <div
                    key={index}
                    className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
                  >
                    <Image
                      src={airline.logo || "/placeholder.svg"}
                      alt={`${airline.name} logo`}
                      width={160}
                      height={80}
                      className="mb-4"
                    />
                    <h3 className="font-bold text-lg mb-2">{airline.name}</h3>
                    <p className="text-gray-600">{airline.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Our Mission */}
        <section className="py-16 bg-blue-700 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
              <p className="text-xl mb-8">
                To provide the most realistic and enjoyable virtual flying
                experience for aviation enthusiasts around the world.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-3">Community</h3>
                  <p>
                    Building a supportive community of virtual pilots who share
                    a passion for aviation.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3">Realism</h3>
                  <p>
                    Striving for the most authentic representation of real-world
                    airline operations.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3">Education</h3>
                  <p>
                    Helping aspiring pilots learn about aviation procedures and
                    airline operations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Join Us CTA */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Join Our Team?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Become part of our virtual pilot community and start your
                journey today.
              </p>
              <div className="flex justify-center space-x-4">
                <Link
                  href="/join-us"
                  className="bg-blue-700 text-white px-6 py-3 rounded hover:bg-blue-800 transition-colors"
                >
                  Apply Now
                </Link>
                <Link
                  href="/operations"
                  className="border border-gray-300 px-6 py-3 rounded hover:bg-gray-50 transition-colors"
                >
                  Learn More
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
