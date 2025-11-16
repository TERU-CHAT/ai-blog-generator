document.getElementById("generateBtn").addEventListener("click", async () => {
 const keyword=document.getElementById("keyword").value.trim();
 const loading=document.getElementById("loading");
 const issues=document.getElementById("issues");
 const result=document.getElementById("result");
 if(!keyword){alert("キーワードを入力してください");return;}
 loading.classList.remove("hidden"); issues.classList.add("hidden"); result.innerHTML="";
 const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({keyword})});
 const data=await res.json(); loading.classList.add("hidden");
 if(!data.ok){issues.classList.remove("hidden"); issues.innerHTML=data.issues.join("<br>");}
 result.innerHTML=data.html || "生成に失敗しました。";
});