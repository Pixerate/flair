// flair-metal-hash: a4234c85
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    packed_float3 uDry;
    float uCracks;
    float uCrackSize;
    float uSag;
    float uCycle;
    uint uAnimate;
    float uProgress;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_wither_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _181)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_181.uBackdrop) * _181.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_181.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _181)
{
    float4 _322;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _322 = overBackdrop(param, _181);
    }
    else
    {
        float2 param_1 = fract(uv);
        _322 = float4(testCard(param_1), 1.0);
    }
    return _322;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 cells(thread const float2& x)
{
    float2 i = floor(x);
    float2 f = fract(x);
    float2 best = float2(0.0);
    float2 bestId = float2(0.0);
    float d1 = 8.0;
    for (int y = -1; y <= 1; y++)
    {
        for (int xx = -1; xx <= 1; xx++)
        {
            float2 g = float2(float(xx), float(y));
            float2 param = i + g;
            float2 o = (g + hash22(param)) - f;
            float d = dot(o, o);
            if (d < d1)
            {
                d1 = d;
                best = o;
                bestId = i + g;
            }
        }
    }
    float edge = 8.0;
    for (int y_1 = -1; y_1 <= 1; y_1++)
    {
        for (int xx_1 = -1; xx_1 <= 1; xx_1++)
        {
            float2 g_1 = float2(float(xx_1), float(y_1));
            float2 param_1 = i + g_1;
            float2 o_1 = (g_1 + hash22(param_1)) - f;
            float2 diff = o_1 - best;
            if (dot(diff, diff) > 9.9999997473787516355514526367188e-06)
            {
                edge = fast::min(edge, dot((best + o_1) * 0.5, fast::normalize(diff)));
            }
        }
    }
    float2 param_2 = bestId;
    return float2(edge, hash12(param_2));
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _181, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_181.iResolution[0], _181.iResolution[1]);
    float aspect = _181.iResolution[0u] / _181.iResolution[1u];
    float u = fract(_181.iTime / _181.uCycle);
    float _494;
    if (_181.uAnimate != 0u)
    {
        _494 = smoothstep(0.0, 0.60000002384185791015625, u) * (1.0 - smoothstep(0.819999992847442626953125, 1.0, u));
    }
    else
    {
        _494 = _181.uProgress;
    }
    float k = _494;
    float2 c = (uv - float2(0.5)) * float2(aspect, 1.0);
    float r2 = dot(c, c);
    float2 st = float2(0.5) + ((uv - float2(0.5)) * (1.0 + (((0.449999988079071044921875 * k) * _181.uSag) * exp((-r2) * 5.0))));
    st.y += (((0.070000000298023223876953125 * k) * _181.uSag) * exp((-r2) * 4.0));
    float2 param = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _181);
    float l = dot(pic.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 dry = float3(_181.uDry) * (0.25 + (0.949999988079071044921875 * l));
    float3 col = mix(pic.xyz, dry, float3(k));
    col = mix(col, ((col - float3(0.5)) * 1.14999997615814208984375) + float3(0.5), float3(k));
    col *= (1.0 - ((0.449999988079071044921875 * k) * smoothstep(0.0500000007450580596923828125, 0.4000000059604644775390625, r2)));
    float2 x = (fragCoord / float2(_181.iResolution[1u])) * _181.uCrackSize;
    float2 param_1 = x;
    float2 cell = cells(param_1);
    float spread = (0.699999988079071044921875 * k) * _181.uCracks;
    float2 param_2 = (x * 0.89999997615814208984375) + float2(11.0);
    float2 param_3 = x * 3.0;
    float open = smoothstep(1.0 - spread, 1.0499999523162841796875 - spread, (vnoise(param_2) * 0.60000002384185791015625) + (vnoise(param_3) * 0.4000000059604644775390625));
    float2 param_4 = x * 12.0;
    float edge = cell.x + ((vnoise(param_4) - 0.5) * 0.039999999105930328369140625);
    float w = (0.01200000010430812835693359375 + (0.02999999932944774627685546875 * k)) * open;
    float crack = (1.0 - smoothstep(0.5 * w, w, edge)) * step(0.001000000047497451305389404296875, w);
    float lip = ((1.0 - smoothstep(w, (2.5 * w) + 0.00999999977648258209228515625, edge)) * open) * (1.0 - crack);
    col = mix(col, (col * 1.14999997615814208984375) + float3(0.039999999105930328369140625), float3(lip * 0.5));
    col = mix(col, float3(0.070000000298023223876953125, 0.0500000007450580596923828125, 0.0350000001490116119384765625), float3(crack * 0.89999997615814208984375));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, crack));
}

fragment flair_wither_frag_out flair_wither_frag(constant FlairUniforms& _181 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_wither_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _737;
    if (_181.flair_flipY > 0.5)
    {
        _737 = _181.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _737 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _737);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _181, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

