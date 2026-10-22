import {connection} from "next/server";
import {Suspense} from "react";
import {WizardPage} from "../wizard-page";
async function NewTitleContent(){await connection();return <WizardPage/>;}
export default function NewTitlePage(){return <Suspense fallback={<main className="min-h-screen bg-background p-8 text-white">Загружаем мастер…</main>}><NewTitleContent/></Suspense>;}
