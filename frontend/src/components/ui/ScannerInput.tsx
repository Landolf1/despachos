import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function ScannerInput({ dispatchId }: { dispatchId: string }) {
  const [buffer, setBuffer] = useState("");
  const [cards, setCards] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (buffer.trim() !== "") {
          const cardNumber = buffer.trim();
          console.log("Código escaneado:", cardNumber);

          supabase.from("dispatch_items")
            .insert({
              dispatch_id: dispatchId,
              card_number: cardNumber,
              client_name: "Cliente desconocido",
            })
            .then(({ error }) => {
              if (error) console.error(error);
              else setCards((prev) => [...prev, cardNumber]);
            });

          setBuffer("");
        }
      } else {
        setBuffer((prev) => prev + e.key);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [buffer, dispatchId]);

  return (
    <div>
      <h3>Tarjetas registradas:</h3>
      <ul>
        {cards.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </div>
  );
}
