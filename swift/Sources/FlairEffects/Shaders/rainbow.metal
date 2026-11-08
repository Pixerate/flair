// flair-metal-hash: c56231ea
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
    float2 uCentre;
    float uRadius;
    float uWidth;
    float uStrength;
    float uSecondary;
    float uDelay;
    float uFade;
    float uRays;
    float2 uSun;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_rainbow_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _150)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_150.uBackdrop) * _150.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_150.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _150)
{
    float4 _291;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _291 = overBackdrop(param, _150);
    }
    else
    {
        float2 param_1 = fract(uv);
        _291 = float4(testCard(param_1), 1.0);
    }
    return _291;
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
float3 spectrum(thread const float& x)
{
    float h = (1.0 - x) * 0.7799999713897705078125;
    float3 c = fast::clamp(abs((fract(float3(h) + float3(0.0, 0.666666686534881591796875, 0.3333333432674407958984375)) * 6.0) - float3(3.0)) - float3(1.0), float3(0.0), float3(1.0));
    return (c * smoothstep(0.0, 0.180000007152557373046875, x)) * smoothstep(1.0, 0.819999992847442626953125, x);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _150, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_150.iResolution[0], _150.iResolution[1]);
    float aspect = _150.iResolution[0u] / _150.iResolution[1u];
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _150);
    float2 p = float2(uv.x * aspect, uv.y);
    float2 c = float2(_150.uCentre.x * aspect, _150.uCentre.y);
    float r = length(p - c);
    float _389;
    if (_150.uFade <= 0.0)
    {
        _389 = step(_150.uDelay, _150.iTime);
    }
    else
    {
        _389 = smoothstep(_150.uDelay, _150.uDelay + _150.uFade, _150.iTime);
    }
    float appear = _389;
    float ground = smoothstep(0.0, 0.3499999940395355224609375, uv.y);
    float2 param_1 = float2(precise::atan2(p.y - c.y, p.x - c.x) * 6.0, _150.iTime * 0.300000011920928955078125);
    float shimmer = 0.85000002384185791015625 + (0.1500000059604644775390625 * vnoise(param_1));
    float x1 = (r - (_150.uRadius - _150.uWidth)) / _150.uWidth;
    float param_2 = x1;
    float3 bow = spectrum(param_2);
    float r2 = _150.uRadius * 1.269999980926513671875;
    float x2 = 1.0 - ((r - r2) / (_150.uWidth * 1.60000002384185791015625));
    float param_3 = x2;
    bow += ((spectrum(param_3) * _150.uSecondary) * 0.60000002384185791015625);
    float inside = (smoothstep(_150.uRadius - _150.uWidth, (_150.uRadius - _150.uWidth) - 0.25, r) * step(0.0, (_150.uRadius - _150.uWidth) - r)) * 0.119999997317790985107421875;
    float between = (smoothstep(_150.uRadius, _150.uRadius + 0.0199999995529651641845703125, r) * smoothstep(r2 - (_150.uWidth * 1.60000002384185791015625), (r2 - (_150.uWidth * 1.60000002384185791015625)) - 0.0199999995529651641845703125, r)) * 0.07999999821186065673828125;
    float amount = ((appear * ground) * shimmer) * _150.uStrength;
    float3 col = pic.xyz;
    col = float3(1.0) - ((float3(1.0) - col) * (float3(1.0) - (bow * amount)));
    col += float3((inside * amount) * 0.800000011920928955078125);
    col *= (1.0 - (between * amount));
    if (_150.uRays > 0.0)
    {
        float2 s = float2(_150.uSun.x * aspect, _150.uSun.y);
        float2 d = p - s;
        float ang = precise::atan2(d.y, d.x);
        float2 param_4 = float2(ang * 9.0, _150.iTime * 0.1500000059604644775390625);
        float2 param_5 = float2((ang * 23.0) + 4.0, _150.iTime * 0.100000001490116119384765625);
        float rays = vnoise(param_4) * vnoise(param_5);
        float fall = exp((-length(d)) * 1.39999997615814208984375);
        col += (((((float3(1.0, 0.930000007152557373046875, 0.75) * ((smoothstep(0.1500000059604644775390625, 0.60000002384185791015625, rays) * 0.699999988079071044921875) + 0.300000011920928955078125)) * fall) * _150.uRays) * appear) * 0.699999988079071044921875);
    }
    fragColor = float4(fast::min(col, float3(1.0)), pic.w);
}

fragment flair_rainbow_frag_out flair_rainbow_frag(constant FlairUniforms& _150 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_rainbow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _659;
    if (_150.flair_flipY > 0.5)
    {
        _659 = _150.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _659 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _659);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _150, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

