"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {deleteTitle,duplicateTitle,setTitleStatus} from "./actions";

export function TitleRowActions({id,slug,name,status}:{id:string;slug:string;name:string;status:string}) {
  const router=useRouter(),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function run(action:()=>Promise<{ok:boolean;error?:string;message?:string;id?:string}>,confirmText?:string,navigate=false){
    if(busy)return;if(confirmText&&!window.confirm(confirmText))return;setBusy(true);setMessage("");
    try{const result=await action();if(!result.ok){setMessage(result.error??"Операция не выполнена.");return;}setMessage(result.message??"Готово.");if(navigate&&result.id)router.push(`/admin/titles/${result.id}/edit`);router.refresh();}catch{setMessage("Не удалось выполнить операцию. Попробуй ещё раз.");}finally{setBusy(false);}
  }
  return <div className="flex min-w-40 flex-col items-start gap-2"><div className="flex flex-wrap gap-2"><Link className="text-violet-300" href={`/admin/titles/${id}/edit`}>Редактировать</Link><Link className="text-zinc-300" href={status==="published"?`/title/${slug}`:`/admin/titles/${id}/preview`}>Предпросмотр</Link></div><div className="flex flex-wrap gap-x-3 gap-y-2 text-xs"><button disabled={busy} onClick={()=>run(()=>setTitleStatus(id,status==="published"?"draft":"published"))}>{status==="published"?"Снять с публикации":"Опубликовать"}</button><button disabled={busy} onClick={()=>run(()=>duplicateTitle(id),undefined,true)}>Создать копию</button><button disabled={busy} onClick={()=>run(()=>setTitleStatus(id,status==="archived"?"draft":"archived"),status==="archived"?undefined:`Переместить «${name}» в архив? Данные останутся в админ-панели.`)}>{status==="archived"?"Вернуть из архива":"В архив"}</button><button disabled={busy} className="text-red-300" onClick={()=>run(()=>deleteTitle(id),`Удалить «${name}» без возможности восстановления? Операция будет остановлена, если найдутся связанные данные.`)}>Удалить</button></div>{message&&<p role="status" className="max-w-64 text-xs text-amber-200">{message}</p>}</div>;
}
