// flair-metal-hash: 8255a189
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
    float uTwist;
    float uSpeed;
    char _m15_pad[8];
    packed_float3 uColor;
    float uTint;
    float3 uCore;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_time_tunnel_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _87)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_87.uBackdrop) * _87.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_87.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _87)
{
    float4 _229;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _229 = overBackdrop(param, _87);
    }
    else
    {
        float2 param_1 = fract(uv);
        _229 = float4(testCard(param_1), 1.0);
    }
    return _229;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _87, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 p = (fragCoord - (float2(_87.iResolution[0], _87.iResolution[1]) * 0.5)) / float2(_87.iResolution[1u]);
    p += (float2(sin(_87.iTime * 0.785398006439208984375), cos(_87.iTime * 1.57079601287841796875)) * 0.0500000007450580596923828125);
    float r = fast::max(length(p), 0.001000000047497451305389404296875);
    float a = precise::atan2(p.y, p.x);
    float z = 0.300000011920928955078125 / r;
    float u = ((a / 6.28318023681640625) + ((_87.uTwist * 0.1500000059604644775390625) * z)) + (_87.iTime * 0.125);
    float v = (z * 0.5) + (_87.iTime * _87.uSpeed);
    float2 param = float2(u * 2.0, v);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _87);
    float3 img = pic.xyz;
    float l = dot(img, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 col = mix(img, (float3(_87.uColor) * l) * 2.2000000476837158203125, float3(_87.uTint));
    col *= (0.85000002384185791015625 + (0.1500000059604644775390625 * smoothstep(0.0, 0.07999999821186065673828125, abs(fract(v * 2.0) - 0.5))));
    float lane = floor(fract(u) * 64.0);
    float2 param_1 = float2(lane, 3.0);
    float h = hash12(param_1);
    float dash = smoothstep(0.85000002384185791015625, 1.0, fract(((z * 0.25) + ((_87.iTime * _87.uSpeed) * 2.0)) + (h * 7.0)));
    float across = ((abs(fract(u * 64.0) - 0.5) / 64.0) * 6.28318023681640625) * r;
    float thin = 1.0 - smoothstep(0.00150000001303851604461669921875, 0.004999999888241291046142578125, across);
    float streak = ((dash * step(0.75, h)) * thin) * smoothstep(0.0500000007450580596923828125, 0.25, r);
    col += (mix(_87.uCore, float3(_87.uColor), float3(0.4000000059604644775390625)) * streak);
    float haze = 1.0 - smoothstep(0.0, 0.20000000298023223876953125, r);
    col = mix(col, _87.uCore, float3(haze));
    col += ((_87.uCore * 0.00200000009499490261077880859375) / float3((r * r) + 0.00999999977648258209228515625));
    col *= (1.0 - (0.449999988079071044921875 * smoothstep(0.5, 0.949999988079071044921875, r)));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::clamp(fast::max(pic.w, fast::max(haze, streak)), 0.0, 1.0));
}

fragment flair_time_tunnel_frag_out flair_time_tunnel_frag(constant FlairUniforms& _87 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_time_tunnel_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _488;
    if (_87.flair_flipY > 0.5)
    {
        _488 = _87.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _488 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _488);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _87, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

