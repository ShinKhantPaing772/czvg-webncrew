import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function FleetPage() {
  // Sample fleet data
  const fleetCategories = [
    {
      category: "Wide-body Aircraft",
      aircraft: [
        {
          type: "Boeing 777-300ER",
          airline: "China Southern Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/4/4/9/449f11d44e6be0994c1ac7fd69a0565967bd46ab.png",
          description:
            "Our flagship long-haul aircraft serving major airports and international routes to Europe, North America, and Australia.",
        },
        {
          type: "Airbus A350-900",
          airline: "China Southern Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/5/d/4/5d49216d40425c10a09098b460bad0bd69a5d7b7.png",
          description:
            "Latest addition to our long-haul fleet, serving major airports and international routes to Europe, North America, and Australia.",
        },
        {
          type: "Airbus A330-300",
          airline: "China Southern Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/7/e/7/7e774e9d23860935ce53d0d8f8ca8624a9f5d214.png",
          description:
            "A big player in our long haul fleet offering superior fuel efficiency, operated on both major and international routes.",
        },
        {
          type: "Boeing 787-8/9 Dreamliner",
          airline: "China Southern Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/9/7/d/97dc473f7f9d9520e894038c9048b2ae8b2eadab.png",
          description:
            "Advanced composite aircraft serving medium to long-haul routes, equipped with special livery.",
        },
        {
          type: "Boeing 787-8/9 Dreamliner",
          airline: "Xiamen Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/optimized/4X/a/9/a/a9aa6451ccf7ab112cd86f8d0a4f46f7c2cdcfcf_2_1640x664.png",
          description:
            "Xiamen Airlines flagship long-haul aircraft serving major airports and international routes to Europe, North America, and Australia.",
        },
        {
          type: "Boeing 777 Freighter",
          airline: "China Southern Cargo",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/0/4/0/0401c2231ffaac4ddfeac1309ce8f7f134f65991.png",
          description:
            "China Southern's cargo aircraft for international and regional routes.",
        },
      ],
    },
    {
      category: "Narrow-body Aircraft",
      aircraft: [
        {
          type: "Airbus A319/20/21/ceo/neo",
          airline: "China Southern Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/7/6/2/762e27e54b98ad4c9c894fca9ee8c1dfa994affb.png",
          description:
            "This aircraft type serves domestic and regional routes.",
        },
        {
          type: "Airbus A321neo",
          airline: "Xiamen Airlines",
          image: "",
          description:
            "Latest generation A321 serving domestic and regional routes.",
        },
        {
          type: "Airbus A319/20/21/ceo/neo",
          airline: "Chengdu Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/4/d/e/4de02ac198b9e8c6d4e200263fb90d50b125cbdf.png",
          description:
            "Chengdu Airline's major aircraft serving domestic routes.",
        },
        {
          type: "Airbus A319/20/21/ceo/neo",
          airline: "Chongqing Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/5/d/f/5df3c8a3a93e27c4e8102864a99e24ee47c7de62.png",
          description:
            "Chongqing Airline's major aircraft serving domestic routes.",
        },
        {
          type: "Boeing 737-700/800/Max 8",
          airline: "China Southern Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/7/c/0/7c0231e4927f43356d12e9e839d1fd21183c49de.png",
          description:
            "Workhorse of our domestic network, connecting regions and major cities across China.",
        },
        {
          type: "Boeing 737-700/800/Max 8",
          airline: "Xiamen Airines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/optimized/4X/2/0/c/20c11416c9168d62ec16a892bafc9eec08c118e4_2_1640x480.png",
          description:
            "Workhorse of our domestic network, connecting regions and major cities across China.",
        },
        {
          type: "Boeing 737-800",
          airline: "Hebei Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/9/2/a/92a634c3d80808527c1f4e614783fdeec2d91a83.png",
          description:
            "Hebei airline workhorse, connecting Shijiazhuang with major cities across China.",
        },
        {
          type: "Boeing 737-800",
          airline: "Jiangxi Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/1/0/2/1025c543a111b67a9cada2ca20e4079d01e88330.png",
          description:
            "Jiangxi airline workhorse, connecting Jiangxi region with major cities across China.",
        },
      ],
    },
    {
      category: "Regional Aircraft",
      aircraft: [
        {
          type: "Embraer E190",
          airline: "Hebei Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/d/a/b/dabde7465cc74e6dab7786e8f16ddfda60f90dda.png",
          description:
            "Regional jet serving smaller cities and lower-demand routes throughout China.",
        },
      ],
    },
    {
      category: "Historical Fleet",
      aircraft: [
        {
          type: "Boeing 747-400F",
          airline: "China Southern Cargo",
          image:
            "https://global.discourse-cdn.com/infiniteflight/optimized/4X/1/d/4/1d49408bf5b2a652de2fe4feccb091a8a485f6f1_2_1640x418.png",
          description:
            "The iconic Queen of the Skies that served our cargo routes, connecting China to the world.",
        },
        {
          type: "Airbus A380-800",
          airline: "China Southern Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/4/2/1/421c1ff1fb2459533ff6b8458d31ca63fc3e21b5.png",
          description:
            "The King of the skies that operated our major routes from 2011 to 2022",
        },
        {
          type: "Boeing 757-200",
          airline: "China Southern Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/5/3/c/53ca439104f455f387197572beb1b44be679c2ff.png",
          description:
            "A classic narrow-body aircraft that served our domestic routes from 1987 to 2018.",
        },
        {
          type: "Boeing 757-200",
          airline: "Xiamen Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/optimized/4X/5/7/b/57bea2fb9a47778f044bbcb8b23f0a8a1a9d8825_2_1640x438.png",
          description:
            "A classic narrow-body aircraft that served our domestic routes in the past.",
        },
        {
          type: "Embraer E190",
          airline: "China Southern Airlines",
          image:
            "https://global.discourse-cdn.com/infiniteflight/original/4X/9/f/d/9fddae7f609a83f4d5f0f0b9cecfe41fce096836.png",
          description:
            "Regional jet serving smaller cities and lower-demand routes throughout China until 2021.",
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
              <span className="text-gray-700">Fleet</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Our Fleet</h1>
            <div className="max-w-3xl">
              <p className="text-lg text-gray-600 mb-8">
                Explore our diverse fleet of aircraft, from regional jets to
                wide-body airliners.
              </p>
            </div>
          </div>
        </section>

        {/* Fleet Overview */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">Fleet Overview</h2>
              <div className="prose prose-lg">
                <p>
                  China Southern Virtual Group operates a diverse fleet of
                  aircraft to serve our extensive network of destinations. Our
                  fleet includes wide-body aircraft for long-haul international
                  routes, narrow-body aircraft for domestic and regional routes,
                  and regional jets for shorter routes to smaller cities.
                </p>
                <p>
                  Our virtual pilots have the opportunity to fly a wide variety
                  of aircraft types, providing a rich and diverse flying
                  experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Fleet Categories */}
        {fleetCategories.map((category, categoryIndex) => (
          <section key={categoryIndex} className="py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold mb-8">{category.category}</h2>
                <div className="space-y-12">
                  {category.aircraft.map((aircraft, aircraftIndex) => (
                    <div
                      key={aircraftIndex}
                      className="bg-gray-50 rounded-xl shadow-md overflow-hidden"
                    >
                      <div className="md:flex p-2">
                        <div className="md:w-2/3 p-6">
                          <h3 className="text-2xl font-bold mb-3">
                            {aircraft.type}
                          </h3>
                          <p className="text-sm text-gray-800 mb-3">
                            {aircraft.airline}
                          </p>
                          <p className="text-gray-600 mb-4">
                            {aircraft.description}
                          </p>
                        </div>
                        <div className="md:w-1/3">
                          <div className="h-64 md:h-full relative">
                            <Image
                              src={aircraft.image || "/placeholder.svg"}
                              alt={aircraft.type}
                              fill
                              className="object-contain"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
                Ready to Fly Our Fleet?
              </h2>
              <p className="text-xl mb-8">
                Join our virtual airline group today and experience flying these
                amazing aircraft.
              </p>
              <div className="flex justify-center space-x-4">
                <Link
                  href="/crew?type=signup"
                  className="bg-white text-blue-700 px-6 py-3 rounded font-medium hover:bg-gray-100 transition-colors"
                >
                  Apply Now
                </Link>
                <Link
                  href="/operations/routes"
                  className="border border-white px-6 py-3 rounded font-medium hover:bg-blue-600 transition-colors"
                >
                  Explore Routes
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
