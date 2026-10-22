"use server";
import {revalidatePath} from "next/cache";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function adminClient(){const db=await createClient(),{data:{user},error}=await db.auth.getUser();if(error||!user)redirect("/login?next=%2Fadmin%2Freports");if(user.app_metadata?.role!=="catalog_admin")notFound();return {db,user};}
export async function reviewContentReport(id:string,status:string,note:string){
 const {db,user}=await adminClient();if(!uuid.test(id)||!["open","in_review","resolved","dismissed"].includes(status))return {ok:false as const,error:"Некорректная жалоба или статус."};
 const resolution=typeof note==="string"?note.trim().slice(0,2000):"";
 const {error}=await db.from("content_reports").update({status,moderator_id:user.id,resolution_note:resolution||null,moderated_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
 if(error){console.error("[admin reports] update report:",error.message);return {ok:false as const,error:error.code==="23505"?"На эту цель уже есть активная жалоба от пользователя.":"Не удалось обновить жалобу."};}
 revalidatePath("/admin/reports");return {ok:true as const};
}
export async function reviewModerationAppeal(id:string,status:string,note:string){
 const {db,user}=await adminClient();if(!uuid.test(id)||!["open","in_review","accepted","rejected"].includes(status))return {ok:false as const,error:"Некорректная апелляция или статус."};
 const resolution=typeof note==="string"?note.trim().slice(0,2000):"";
 const {data:appeal,error:lookupError}=await db.from("moderation_appeals").select("user_id").eq("id",id).maybeSingle();if(lookupError||!appeal)return {ok:false as const,error:"Апелляция не найдена."};
 if(status==="accepted"){
  const {error:restoreError}=await db.rpc("admin_set_profile_moderation",{target_user_id:appeal.user_id,suspend_profile:false,reason_text:null});
  if(restoreError)return {ok:false as const,error:"Апелляция отмечена принятой, но ограничение не снялось. Сними его вручную в разделе модерации профилей."};
 }
 const {error}=await db.from("moderation_appeals").update({status,moderator_id:user.id,resolution_note:resolution||null,moderated_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
 if(error){console.error("[admin reports] update appeal:",error.message);return {ok:false as const,error:"Не удалось сохранить решение. Проверь профиль владельца и очередь апелляций."};}
 revalidatePath("/admin/reports");revalidatePath("/admin");return {ok:true as const};
}
