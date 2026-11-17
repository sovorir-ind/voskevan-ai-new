
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

const instructions = `
Դու «Ոսկեվան AI — Քո անձնական ուսուցիչը» կրթական օգնականն ես։

Քո նպատակն է սովորեցնել 1-12-րդ դասարանների աշակերտներին։

ԿԱՆՈՆՆԵՐ.

1. Պատասխանիր հայերենով։
2. Հասկացիր նաև խոսակցական հայերենը և տառասխալներով հարցերը։
3. Բացատրիր պարզ, հերթական քայլերով։
4. Հաշվի առ աշակերտի դասարանը և ընտրված առարկան։
5. Մաթեմատիկական խնդիրները լուծիր քայլ առ քայլ։
6. Եթե հարցը անհասկանալի է, տուր ճշտող հարց։
7. Մի հորինիր փաստեր։
8. Եթե վստահ չես, ազնվորեն ասա։
9. Կարևոր փաստերի համար օգտագործիր վստահելի աղբյուրներ։
10. Օգնիր աշակերտին հասկանալ, ոչ թե պարզապես արտագրել։
11. Պահպանիր նախորդ զրույցի համատեքստը։
12. Մի պնդիր, որ երբեք չես սխալվում։

Դու պետք է լինես համբերատար, խելացի և հասկանալի ուսուցիչ։
`;

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors
    });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Սխալ հարցման տեսակ։" }),
      { status: 405, headers: cors }
    );
  }

  try {
    const apiKey = Netlify.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY-ը ավելացված չէ Netlify-ում։"
      );
    }

    const body = await request.json();

    const message = String(body.message || "").trim();
    const grade = String(body.grade || "9");
    const subject = String(
      body.subject || "Բոլոր առարկաները"
    );

    if (!message) {
      throw new Error("Գրիր քո հարցը։");
    }

    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };

    let conversationId = String(
      body.conversation_id || ""
    );

    // Ստեղծում ենք զրույց, եթե այն դեռ չկա
    if (!conversationId) {
      const conversationResponse = await fetch(
        "https://api.openai.com/v1/conversations",
        {
          method: "POST",
          headers,
          body: JSON.stringify({})
        }
      );

      const conversationData =
        await conversationResponse.json();

      if (!conversationResponse.ok) {
        throw new Error(
          conversationData.error?.message ||
          "Չհաջողվեց սկսել զրույցը։"
        );
      }

      conversationId = conversationData.id;
    }

    const model =
      Netlify.env.get("OPENAI_MODEL") ||
      "gpt-6.2-astra";

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model,
          conversation: conversationId,

          instructions:
            instructions +
            `\nԱշակերտի դասարան՝ ${grade}։` +
            `\nԱռարկա՝ ${subject}։`,

          input: message,

          tools: [
            { type: "web_search" }
          ],

          tool_choice: "auto",
          max_output_tokens: 2500
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "AI ծառայության հետ կապի սխալ։"
      );
    }

    const reply =
      data.output_text ||
      (data.output || [])
        .flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("\n") ||
      "Այս պահին պատասխան չստացվեց։";

    return new Response(
      JSON.stringify({
        reply: reply,
        conversation_id: conversationId
      }),
      {
        status: 200,
        headers: cors
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "Անհայտ սխալ։"
      }),
      {
        status: 500,
        headers: cors
      }
    );
  }
};
