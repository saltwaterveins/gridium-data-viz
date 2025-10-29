import Image from "next/image";
import Readings from "./components/readings/readings-component";
import Billings from "./components/billings/billings-component";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center font-sans dark:bg-black">
		<Readings />
		<Billings />
    </div>
  );
}
