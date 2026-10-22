"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories=["incorrect_info","copyright","harassment","privacy","spam","other"] as const;
type ReportTarget={type:"title"|"profile";id:string};

export async function createContentReport(target:ReportTarget,category:string,description:string){
 const db=await createClient(),{data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return {ok:false as const,error:"Войди в аккаунт, чтобы отправить жалобу."};
 if(!target||!(target.type==="title"||target.type==="profile")||!uuid.test(target.id)||!categories.includes(category as typeof categories[number]))return {ok:false as const,error:"Проверь тип материала и категорию жалобы."};
 const text=typeof description==="string"?description.trim().slice(0,2000):"";
 if(text.length<10)return {ok:false as const,error:"Добавь описание от 10 символов."};
 if(target.type==="title"){
  const {data,error}=await db.from("titles").select("id").eq("id",target.id).eq("status","published").maybeSingle();
  if(error||!data)return {ok:false as const,error:"Тайтл не найден или уже скрыт."};
 }else{
  if(target.id===user.id)return {ok:false as const,error:"Нельзя отправить жалобу на собственный профиль."};
  const {data,error}=await db.from("profiles").select("id").eq("id",target.id).eq("is_public",true).eq("is_suspended",false).maybeSingle();
  if(error||!data)return {ok:false as const,error:"Профиль не найден или больше не публичный."};
 }
 const {error}=await db.from("content_reports").insert({reporter_id:user.id,target_type:target.type,target_id:target.id,category,description:text});
 if(error?.code==="23505")return {ok:false as const,error:"У тебя уже есть активная жалоба на этот объект."};
 if(error){console.error("[reports] submit:",error.message);return {ok:false as const,error:"Не удалось отправить жалобу."};}
 revalidatePath("/admin/reports");
 return {ok:true as const,message:"Жалоба отправлена. Её увидит команда модерации."};
}

export async function submitModerationAppeal(reason:string){
 const db=await createClient(),{data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return {ok:false as const,error:"Войди в аккаунт, чтобы отправить апелляцию."};
 const text=typeof reason==="string"?reason.trim().slice(0,2000):"";
 if(text.length<20)return {ok:false as const,error:"Опиши причину апелляции (не менее 20 символов)."};
 const {data:profile,error:profileError}=await db.from("profiles").select("id").eq("id",user.id).eq("is_suspended",true).maybeSingle();
 if(profileError||!profile)return {ok:false as const,error:"Апелляция доступна, если профиль ограничен модерацией."};
 const {error}=await db.from("moderation_appeals").insert({user_id:user.id,reason:text});
 if(error?.code==="23505")return {ok:false as const,error:"У тебя уже есть незакрытая апелляция."};
 if(error){console.error("[reports] appeal:",error.message);return {ok:false as const,error:"Не удалось отправить апелляцию."};}
 revalidatePath("/account");revalidatePath("/admin/reports");
 return {ok:true as const,message:"Апелляция отправлена на рассмотрение."};
}
