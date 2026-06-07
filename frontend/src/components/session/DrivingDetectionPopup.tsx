import { Car } from "lucide-react";
import { ClayButton } from "../ui/ClayButton";

interface Props {
  onConfirm: () => void;
  onDismiss: () => void;
}

export function DrivingDetectionPopup({ onConfirm, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl clay-shadow-lg w-full max-w-sm p-6 text-center">
        <div className="flex justify-center mb-3">
          <Car className="w-10 h-10 text-mint" />
        </div>
        <h3 className="font-bold text-gray-800 text-lg mb-2">Driving detected</h3>
        <p className="text-sm text-gray-500 mb-5">
          Speed has been above 20 km/h for over a minute.<br />
          Start heart rate monitoring?
        </p>
        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={onDismiss} className="flex-1">Not now</ClayButton>
          <ClayButton colorClass="bg-mint text-white flex-1" onClick={onConfirm}>Yes, monitor me</ClayButton>
        </div>
      </div>
    </div>
  );
}
