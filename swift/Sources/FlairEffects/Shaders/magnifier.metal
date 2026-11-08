// flair-metal-hash: f12404a9
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
    float uZoom;
    float uRadius;
    float uAberration;
    char _m16_pad[4];
    packed_float3 uRim;
    uint uDemo;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_magnifier_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _52)
{
    float2 drift = float2(_52.iResolution[0], _52.iResolution[1]) * (float2(0.5) + float2(0.2800000011920928955078125 * sin(_52.iTime * 0.62999999523162841796875), 0.2199999988079071044921875 * sin((_52.iTime * 0.910000026226043701171875) + 1.2999999523162841796875)));
    float h = fast::clamp(_52.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _52.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _52)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_52.uBackdrop) * _52.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_52.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _52)
{
    float4 _251;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _251 = overBackdrop(param, _52);
    }
    else
    {
        float2 param_1 = fract(uv);
        _251 = float4(testCard(param_1), 1.0);
    }
    return _251;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _52, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_52.iResolution[0], _52.iResolution[1]);
    bool param = _52.uDemo != 0u;
    float param_1 = 1.0;
    float3 hp = hoverPoint(param, param_1, _52);
    float s = hp.z;
    float2 param_2 = uv;
    float4 col = pictureRGBA(uImage, uImageSmplr, param_2, _52);
    float R = (_52.uRadius * (0.75 + (0.25 * s))) * _52.iResolution[1u];
    float2 d = fragCoord - hp.xy;
    float r = length(d);
    float k = r / R;
    float shadow = 1.0 - smoothstep(R * 0.89999997615814208984375, R * 1.2999999523162841796875, length(d - float2(R * 0.07999999821186065673828125, (-R) * 0.119999997317790985107421875)));
    float4 _342 = col;
    float3 _344 = _342.xyz * (1.0 - ((0.3499999940395355224609375 * shadow) * s));
    col.x = _344.x;
    col.y = _344.y;
    col.z = _344.z;
    if (k < 1.0499999523162841796875)
    {
        float2 q = (d / float2(_52.uZoom)) * (1.0 + ((((0.4000000059604644775390625 * k) * k) * k) * k));
        float fr = (((_52.uAberration * 0.07999999821186065673828125) * k) * k) * k;
        float2 param_3 = (hp.xy + (q * (1.0 + fr))) / float2(_52.iResolution[0], _52.iResolution[1]);
        float4 lr = pictureRGBA(uImage, uImageSmplr, param_3, _52);
        float2 param_4 = (hp.xy + q) / float2(_52.iResolution[0], _52.iResolution[1]);
        float4 lg = pictureRGBA(uImage, uImageSmplr, param_4, _52);
        float2 param_5 = (hp.xy + (q * (1.0 - fr))) / float2(_52.iResolution[0], _52.iResolution[1]);
        float4 lb = pictureRGBA(uImage, uImageSmplr, param_5, _52);
        float4 lens = float4(lr.x, lg.y, lb.z, fast::max(fast::max(lr.w, lg.w), lb.w));
        float4 _455 = lens;
        float3 _458 = _455.xyz + float3(0.1599999964237213134765625 * exp(-powr(length((d / float2(R)) - float2(-0.3499999940395355224609375, 0.4000000059604644775390625)) * 2.599999904632568359375, 2.0)));
        lens.x = _458.x;
        lens.y = _458.y;
        lens.z = _458.z;
        float4 _470 = lens;
        float3 _472 = _470.xyz * (1.0 - (0.25 * powr(k, 6.0)));
        lens.x = _472.x;
        lens.y = _472.y;
        lens.z = _472.z;
        col = mix(col, lens, float4((1.0 - smoothstep(R - 1.5, R, r)) * s));
    }
    float rimW = fast::max(R * 0.0350000001490116119384765625, 2.0);
    float lit = 0.60000002384185791015625 + (0.4000000059604644775390625 * dot(d / float2(fast::max(r, 9.9999997473787516355514526367188e-05)), float2(-0.707106769084930419921875, 0.707106769084930419921875)));
    float rim = exp(-powr((r - R) / rimW, 2.0));
    col = mix(col, float4(float3(_52.uRim) * lit, 1.0), float4((rim * s) * 0.89999997615814208984375));
    fragColor = col;
}

fragment flair_magnifier_frag_out flair_magnifier_frag(constant FlairUniforms& _52 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_magnifier_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _548;
    if (_52.flair_flipY > 0.5)
    {
        _548 = _52.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _548 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _548);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _52, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

