// flair-metal-hash: c10798c9
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
    float3 uBackground;
    packed_float3 uLine;
    float uLineAlpha;
    float3 uColorA;
    float3 uColorB;
    packed_float3 uColorC;
    int uCount;
    float uSpeed;
    float uLength;
    float uGlow;
    float uBackgroundAlpha;
};

struct flair_background_beams_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75)
{
    float px = 1.0 / _75.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _75.iResolution[0u] * px;
    float x = p.x / aspect;
    float3 col = _75.uBackground;
    col += ((mix(_75.uColorB, _75.uColorA, float3(0.5)) * 0.07999999821186065673828125) * exp((-dot(p - float2(0.0, 0.100000001490116119384765625), p - float2(0.0, 0.100000001490116119384765625))) * 2.0));
    float3 light = float3(0.0);
    float n = float(_75.uCount);
    float3 _322;
    for (int i = 0; i < 24; i++)
    {
        if (i >= _75.uCount)
        {
            break;
        }
        float k = (float(i) + 0.5) / n;
        float2 param = float2(float(i), 3.7000000476837158203125);
        float2 h = hash22(param);
        float y0 = (-0.25) + (0.550000011920928955078125 * k);
        float y1 = 0.3499999940395355224609375 + (0.89999997615814208984375 * k);
        float amp = 0.0500000007450580596923828125 + (0.0500000007450580596923828125 * h.x);
        float fr = 2.5 + (2.0 * h.y);
        float ph = 6.280000209808349609375 * h.x;
        float y = mix(y0, y1, x) + (amp * sin((x * fr) + ph));
        float dy = ((y1 - y0) / aspect) + (((amp * fr) / aspect) * cos((x * fr) + ph));
        float d = (abs(p.y - y) / sqrt(1.0 + (dy * dy))) / px;
        if (d > 40.0)
        {
            continue;
        }
        float line = fast::clamp(1.10000002384185791015625 - d, 0.0, 1.0);
        col = mix(col, float3(_75.uLine), float3(line * _75.uLineAlpha));
        float head = (fract((((_75.iTime * _75.uSpeed) * (0.5 + (0.60000002384185791015625 * h.y))) / (1.0 + _75.uLength)) + h.x) * (1.0 + (2.0 * _75.uLength))) - (0.5 * _75.uLength);
        float behind = (head - x) / _75.uLength;
        if ((behind > 0.0) && (behind < 1.0))
        {
            float k2 = powr(1.0 - behind, 1.5) * smoothstep(0.0, 0.07999999821186065673828125, behind);
            if (behind < 0.5)
            {
                _322 = mix(_75.uColorA, _75.uColorB, float3(behind * 2.0));
            }
            else
            {
                _322 = mix(_75.uColorB, float3(_75.uColorC), float3((behind * 2.0) - 1.0));
            }
            float3 c = _322;
            light += ((c * k2) * ((fast::clamp(1.39999997615814208984375 - d, 0.0, 1.0) * 1.39999997615814208984375) + ((_75.uGlow * 0.5) * exp((-d) / 6.0))));
        }
    }
    col += light;
    col /= (float3(1.0) + fast::max(col - float3(1.0), float3(0.0)));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _431;
    if (a > 0.0)
    {
        _431 = bg + (d / float3(a));
    }
    else
    {
        _431 = bg;
    }
    float3 fg = _431;
    float alpha = a + (opacity * (1.0 - a));
    float3 _453;
    if (alpha > 0.0)
    {
        _453 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _453 = bg;
    }
    float3 col = _453;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _75);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _75.uBackground;
    float param_4 = _75.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_background_beams_frag_out flair_background_beams_frag(constant FlairUniforms& _75 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_background_beams_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _511;
    if (_75.flair_flipY > 0.5)
    {
        _511 = _75.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _511 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _511);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _75);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

