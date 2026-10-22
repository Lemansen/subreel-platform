import {connection} from "next/server";
import {Suspense} from "react";
import {WizardPage} from "../../wizard-page";
async function EditTitleContent({params}:{params:Promise<{id:string}>}){await connection();const {id}=await params;return <WizardPage titleId={id}/>;}
export default function EditTitlePage({params}:{params:Promise<{id:string}>}){return <Suspense fallback={<main className="min-h-screen bg-background p-8 text-white">Загружаем мастер…</main>}><EditTitleContent params={params}/></Suspense>;}
