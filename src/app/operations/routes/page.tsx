import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function RoutesPage() {
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
        {/* Route Database Section */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">Route Database</h2>
              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="aspect-[16/9] relative">
                  <iframe
                    src="https://docs.google.com/spreadsheets/d/e/2PACX-1vQy_RZcm7fYgsDP1kmXyUAdVonqUegj5MeoNmflJJxKGuers9kTO1mDlYdpRlDJU6OQTc-trocUHDM1/pubhtml"
                    className="w-full h-full rounded"
                    style={{ border: 0 }}
                  />
                </div>
                <p className="text-center text-sm text-gray-500 mt-2">
                  * Route Database displayed here may be outdated, please refer
                  to crew center's routes for the most up-to-date information.
                </p>
              </div>
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
                  extensive networks in the Infinite Flight virtual aviation
                  community, with over 300 destinations and 1000+ routes across
                  China and around the world.
                </p>
              </div>
              {[
                {
                  src: "https://www.google.com/maps/d/embed?mid=1WEqoxQ5vrtWtqnLRG3J6iZ8ETRALeGm6&ehbc=2E312F",
                  title: "China Southern Airlines Route Network",
                },
                {
                  src: "https://www.google.com/maps/d/embed?mid=1NsyoNS1wTR1EL6xqQVQekk-VzW_A-sGz&ehbc=2E312F",
                  title: "Xiamen Airlines Route Network",
                },
                {
                  src: "https://www.google.com/maps/d/embed?mid=1d9YI86mJca95WoM56MiP-p-My4JLyjv2&ehbc=2E312F",
                  title: "Chengdu Airines Route Network",
                },
                {
                  src: "https://www.google.com/maps/d/embed?mid=1bp5K5xbt6hIgRgyTtKj1h9aMMlKvUHzE&ehbc=2E312F",
                  title: "Hebei Airlines Route Network",
                },
                {
                  src: "https://www.google.com/maps/d/embed?mid=1aKencXbuaoExxWIkXPEEqQzf_nFCa-Mu&ehbc=2E312F",
                  title: "Jiangxi Airlines Route Network",
                },
                {
                  src: "https://www.google.com/maps/d/embed?mid=1ZPcLrGGiHFiJ6-wr6fPAbSyq9mEK49yy&ehbc=2E312F",
                  title: "Chongqing Airlines Route Network",
                },
              ].map((map, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow-md">
                  <div className="aspect-[16/9] relative">
                    <iframe
                      src={map.src}
                      width="1280"
                      height="720"
                      className="w-full h-full rounded"
                    />
                  </div>
                  <p className="text-center text-sm text-gray-500 mt-2">
                    {map.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* Codeshare Partners Section */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">Codeshare Partners</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[
                  {
                    name: "American Virtual",
                    logo: "https://global.discourse-cdn.com/infiniteflight/original/4X/f/6/6/f66924dfe2dd443e42ef83213071371331f0d375.png",
                  },
                  {
                    name: "Air France KLM Group",
                    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Air_France_KLM_Group_logo.svg/580px-Air_France_KLM_Group_logo.svg.png",
                  },
                  {
                    name: "Air Europa Virtual",
                    logo: "https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/aireuropavirtual/288/799321_2.png",
                  },
                  {
                    name: "Qatar Airways",
                    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/9/9b/Qatar_Airways_Logo.svg/500px-Qatar_Airways_Logo.svg.png",
                  },
                  {
                    name: "Dubai Virtual",
                    logo: "https://dubaiva.weebly.com/uploads/1/3/2/6/132622991/dubai-virtual-airlines-logo-2-white-writing_orig.png",
                  },
                  {
                    name: "Saudia Virtual",
                    logo: "https://global.discourse-cdn.com/infiniteflight/original/4X/7/1/7/7175e1702c01503341f88921b30db1d60fa04747.png",
                  },
                  {
                    name: "Etihad Virtual",
                    logo: "https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/etihad_virtual/288/851859_2.png",
                  },
                  {
                    name: "WestJet",
                    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/WestJetLogo2018.svg/560px-WestJetLogo2018.svg.png",
                  },
                ].map((partner, index) => (
                  <div
                    key={index}
                    className="bg-white p-4 rounded-lg shadow-md flex flex-col items-center"
                  >
                    <div className="w-32 h-32 relative mb-4">
                      <Image
                        src={partner.logo}
                        alt={`${partner.name} logo`}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <h3 className="text-center font-medium">{partner.name}</h3>
                  </div>
                ))}
                <p className="justify-center">and more...</p>
              </div>
            </div>
          </div>
        </section>

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
                  href="/crew?type=signup"
                  className="bg-white text-blue-700 px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition-colors"
                >
                  Apply Now
                </Link>
                <Link
                  href="/operations/fleet"
                  className="border border-white px-6 py-3 rounded-md font-medium hover:bg-blue-600 transition-colors"
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
