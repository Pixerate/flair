// flair-metal-hash: 42602e4c
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
    packed_float3 uColor;
    float uTargetX;
    float uTargetY;
    float uRest;
    float uFastest;
    float uStrength;
    uint uDemo;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_heartbeat_vignette_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _53)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_53.uBackdrop) * _53.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_53.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _53)
{
    float4 _197;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _197 = overBackdrop(param, _53);
    }
    else
    {
        float2 param_1 = fract(uv);
        _197 = float4(testCard(param_1), 1.0);
    }
    return _197;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _53, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_53.iResolution[0], _53.iResolution[1]);
    float aspect = _53.iResolution[0u] / _53.iResolution[1u];
    float2 target = float2(_53.uTargetX * aspect, _53.uTargetY);
    float hover = fast::clamp(_53.iPointer.z, 0.0, 1.0);
    float2 pointer = (_53.iPointer.xy - (float2(_53.iResolution[0], _53.iResolution[1]) * 0.5)) / float2(_53.iResolution[1u]);
    float _266;
    if (_53.uDemo != 0u)
    {
        _266 = 0.699999988079071044921875 * (0.5 + (0.5 * cos(_53.iTime * 0.300000011920928955078125)));
    }
    else
    {
        _266 = 0.699999988079071044921875;
    }
    float idle = _266;
    float d = mix(idle, length(pointer - target), hover);
    float near = 1.0 - smoothstep(0.0500000007450580596923828125, 0.699999988079071044921875, d);
    float bpm = fast::min(mix(_53.uRest, fast::max(_53.uFastest, _53.uRest), near), 120.0);
    float f = fract((_53.iTime * bpm) / 60.0);
    float swell = smoothstep(0.0, 0.100000001490116119384765625, f) * exp((-fast::max(f - 0.100000001490116119384765625, 0.0)) * 4.5);
    float2 st = float2(0.5) + ((uv - float2(0.5)) / float2(1.0 + ((0.006000000052154064178466796875 * swell) * (0.5 + near))));
    float2 param = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _53);
    float l = dot(pic.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 col = mix(pic.xyz, float3(l) * 0.85000002384185791015625, float3((0.5 * near) * _53.uStrength));
    float2 e = (uv - float2(0.5)) * 2.0;
    float r = length(e * float2(1.0, 0.85000002384185791015625));
    float reach = (1.0499999523162841796875 - (0.25 * near)) - (0.119999997317790985107421875 * swell);
    float edge = smoothstep(reach - 0.449999988079071044921875, reach + 0.20000000298023223876953125, r);
    float amount = _53.uStrength * (0.3499999940395355224609375 + ((0.64999997615814208984375 * swell) * (0.449999988079071044921875 + (0.550000011920928955078125 * near))));
    col = mix(col, float3(_53.uColor) * (0.5 + (0.5 * swell)), float3(edge * amount));
    fragColor = float4(col, pic.w);
}

fragment flair_heartbeat_vignette_frag_out flair_heartbeat_vignette_frag(constant FlairUniforms& _53 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_heartbeat_vignette_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _443;
    if (_53.flair_flipY > 0.5)
    {
        _443 = _53.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _443 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _443);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _53, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

