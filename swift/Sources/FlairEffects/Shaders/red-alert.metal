// flair-metal-hash: 3d3e20ed
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
    float uRate;
    float uDarken;
    float uSweep;
    float uPulse;
    float uBeaconX;
    float uVignette;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_red_alert_frag_out
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
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _53);
    float lum = dot(pic.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 grey = mix(pic.xyz, float3(lum), float3(0.699999988079071044921875));
    float rate = fast::clamp(_53.uRate, 0.20000000298023223876953125, 1.5);
    float turn = fract(_53.iTime * rate);
    float heading = mix(-1.7999999523162841796875, 1.7999999523162841796875, turn);
    float2 d = float2((uv.x - _53.uBeaconX) * aspect, uv.y - 1.08000004291534423828125);
    float angle = precise::atan2(d.x, -d.y);
    float width = 0.1599999964237213134765625 + (0.100000001490116119384765625 * smoothstep(0.0, 1.2000000476837158203125, length(d)));
    float beam = exp(-powr((angle - heading) / width, 2.0)) * smoothstep(1.7999999523162841796875, 1.2000000476837158203125, abs(heading));
    float pulse = 0.5 + (0.5 * cos(heading * 1.7000000476837158203125));
    float3 ambient = float3(1.0 - (_53.uDarken * 0.87999999523162841796875));
    float3 lit = ambient + (float3(_53.uColor) * (((_53.uPulse * 0.89999997615814208984375) * pulse) + ((_53.uSweep * 2.2000000476837158203125) * beam)));
    float3 col = grey * lit;
    float glow = exp((-dot(d, d)) * 40.0);
    col += ((float3(_53.uColor) * glow) * (0.4000000059604644775390625 + (0.60000002384185791015625 * pulse)));
    float2 v = uv - float2(0.5);
    col *= (1.0 - (_53.uVignette * smoothstep(0.25, 0.800000011920928955078125, length(v * float2(aspect / 1.39999997615814208984375, 1.0)))));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), pic.w);
}

fragment flair_red_alert_frag_out flair_red_alert_frag(constant FlairUniforms& _53 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_red_alert_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _414;
    if (_53.flair_flipY > 0.5)
    {
        _414 = _53.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _414 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _414);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _53, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

