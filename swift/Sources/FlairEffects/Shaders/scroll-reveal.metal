// flair-metal-hash: 11d957b3
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
    int uStyle;
    float uStart;
    float uEnd;
    float uSoftness;
    float uZoom;
    char _m18_pad[12];
    packed_float3 uEdge;
    float uEdgeGlow;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    uint uDemo;
};

struct flair_scroll_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool scrollDemo(constant FlairUniforms& _67)
{
    bool _317 = _67.uDemo != 0u;
    bool _328;
    if (_317)
    {
        _328 = dot(_67.iScroll, _67.iScroll) == 0.0;
    }
    else
    {
        _328 = _317;
    }
    return _328;
}

static inline __attribute__((always_inline))
float4 scroll(constant FlairUniforms& _67)
{
    if (!scrollDemo(_67))
    {
        return _67.iScroll;
    }
    float ph = fract(_67.iTime / 6.0);
    float _347;
    if (ph < 0.5)
    {
        _347 = (ph * 2.400000095367431640625) - 0.100000001490116119384765625;
    }
    else
    {
        _347 = ((1.0 - ph) * 2.400000095367431640625) - 0.100000001490116119384765625;
    }
    float u = fast::clamp(_347, 0.0, 1.0);
    float x = (u * u) * (3.0 - (2.0 * u));
    float moving = float((u > 0.0) && (u < 1.0));
    float v = (((((moving * 6.0) * u) * (1.0 - u)) * 0.4000000059604644775390625) * 2.0) * ((ph < 0.5) ? 1.0 : (-1.0));
    return float4(x, x, v, moving);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _67)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_67.uBackdrop) * _67.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_67.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _67)
{
    float4 _210;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _210 = overBackdrop(param, _67);
    }
    else
    {
        float2 param_1 = fract(uv);
        _210 = float4(testCard(param_1), 1.0);
    }
    return _210;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _67, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_67.iResolution[0], _67.iResolution[1]);
    float4 s = scroll(_67);
    float r = smoothstep(_67.uStart, fast::max(_67.uEnd, _67.uStart + 0.001000000047497451305389404296875), s.x);
    float field;
    if (_67.uStyle == 0)
    {
        float2 param = float2(uv.x * 9.0, 0.0);
        field = (1.0 - uv.y) + (0.039999999105930328369140625 * (vnoise(param) - 0.5));
    }
    else
    {
        if (_67.uStyle == 1)
        {
            float2 param_1 = (fragCoord / float2(_67.iResolution[1u])) * 18.0;
            float2 param_2 = (fragCoord / float2(_67.iResolution[1u])) * 60.0;
            field = (vnoise(param_1) * 0.60000002384185791015625) + (vnoise(param_2) * 0.4000000059604644775390625);
        }
        else
        {
            if (_67.uStyle == 2)
            {
                field = length((uv - float2(0.5)) * float2(_67.iResolution[0u] / _67.iResolution[1u], 1.0)) / 0.89999997615814208984375;
            }
            else
            {
                field = (fract(uv.y * 8.0) * 0.89999997615814208984375) + (uv.y * 0.100000001490116119384765625);
            }
        }
    }
    float soft = fast::max(_67.uSoftness, 0.001000000047497451305389404296875);
    float edge = (r * (1.0 + soft)) - soft;
    float shown = smoothstep(edge + soft, edge, field);
    float rim = (exp(-powr(((field - edge) - (soft * 0.5)) / ((soft * 0.3499999940395355224609375) + 0.00999999977648258209228515625), 2.0)) * (1.0 - step(0.999000012874603271484375, r))) * step(0.001000000047497451305389404296875, r);
    float2 at = ((uv - float2(0.5)) / float2(1.0 + (_67.uZoom * (1.0 - r)))) + float2(0.5);
    float2 param_3 = at;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_3, _67);
    float3 col = pic.xyz + ((float3(_67.uEdge) * rim) * _67.uEdgeGlow);
    float alpha = pic.w * shown;
    fragColor = float4(col, fast::clamp(fast::max(alpha, (rim * _67.uEdgeGlow) * pic.w), 0.0, 1.0));
}

fragment flair_scroll_reveal_frag_out flair_scroll_reveal_frag(constant FlairUniforms& _67 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_scroll_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _608;
    if (_67.flair_flipY > 0.5)
    {
        _608 = _67.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _608 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _608);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _67, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

