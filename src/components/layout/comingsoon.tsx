"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function ComingSoonPage() {
  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Set launch date - change this to your actual launch date
  const launchDate = new Date("2025-04-15T00:00:00");

  // Update countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const difference = launchDate.getTime() - now.getTime();

      if (difference <= 0) {
        clearInterval(timer);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="container px-4 py-16 md:py-24 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8 flex justify-center">
              <div className="inline-flex items-center p-2 bg-white rounded-full">
                <img
                  src="https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/chinasouthernvg/288/886608_2.png"
                  alt="China Southern Virtual Group Logo"
                  className="h-6 w-6"
                />
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              We're Coming Back Soon
            </h1>

            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
              Our new crew center is under development and will be ready soon.
            </p>
          </div>
        </div>
      </main>

      {/* Countdown Timer
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <div className="bg-white p-4 rounded-lg shadow-md border">
                <div className="text-4xl font-bold text-blue-700">
                  {timeLeft.days}
                </div>
                <div className="text-gray-500">Days</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md border">
                <div className="text-4xl font-bold text-blue-700">
                  {timeLeft.hours}
                </div>
                <div className="text-gray-500">Hours</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md border">
                <div className="text-4xl font-bold text-blue-700">
                  {timeLeft.minutes}
                </div>
                <div className="text-gray-500">Minutes</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md border">
                <div className="text-4xl font-bold text-blue-700">
                  {timeLeft.seconds}
                </div>
                <div className="text-gray-500">Seconds</div>
              </div>
            </div>

            {/* Features Preview 
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-blue-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">Virtual Flights</h3>
                <p className="text-gray-600">
                  Experience realistic virtual flights with our extensive route
                  network and diverse fleet.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-blue-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">Pilot Community</h3>
                <p className="text-gray-600">
                  Join our growing community of virtual pilots and aviation
                  enthusiasts.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-blue-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">Career Progression</h3>
                <p className="text-gray-600">
                  Advance through our ranks and track your progress as a virtual
                  pilot.
                </p>
              </div>
            </div>
          </div>
        </div>*/}

      {/* Social Media Links */}
      <div className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-center space-x-6">
            <a
              href="https://ifvarb.com/database.php?action=view&xid=1226"
              className="text-gray-600 hover:text-blue-700"
            >
              <span className="sr-only">IFVARB</span>
              <svg
                className="h-6 w-6"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
                fill="none"
                stroke="#f1b357"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
              >
                <path d="m14.25 8.75c-.5 2.5-2.3849 4.85363-5.03069 5.37991-2.64578.5263-5.33066-.7044-6.65903-3.0523-1.32837-2.34784-1.00043-5.28307.81336-7.27989 1.81379-1.99683 4.87636-2.54771 7.37636-1.54771" />
                <polyline points="5.75 7.75,8.25 10.25,14.25 3.75" />
              </svg>
            </a>

            <a
              href="https://community.infiniteflight.com/u/chinasouthernvg/"
              className="text-gray-600 hover:text-blue-700"
            >
              <span className="sr-only">IFC</span>
              <img
                src="https://webcdn.infiniteflight.com/static/favicon.png"
                alt="IFC icon"
                className="h-6 w-6"
              />
            </a>
            <a
              href="https://www.instagram.com/chinasouthernvg_if/"
              className="text-gray-600 hover:text-blue-700"
            >
              <span className="sr-only">Instagram</span>
              <svg
                className="h-6 w-6"
                fill="#eb3588"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
