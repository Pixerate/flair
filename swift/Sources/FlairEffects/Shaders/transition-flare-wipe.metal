// flair-metal-hash: 98002d14
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
    uint uAnimate;
    float uProgress;
    char _m15_pad[8];
    packed_float3 uColor;
    float uHeight;
    float uStrength;
    float uBloom;
    uint uReverse;
    char _m20_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_flare_wipe_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _56)
{
    float _225;
    if (_56.uAnimate != 0u)
    {
        _225 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_56.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _225 = _56.uProgress;
    }
    return _225;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _56)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_56.uBackdrop) * _56.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_56.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _56)
{
    float4 _200;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _200 = overBackdrop(param, _56);
    }
    else
    {
        float2 param_1 = fract(uv);
        _200 = float4(testCard(param_1), 1.0);
    }
    return _200;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _56, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_56.iResolution[0], _56.iResolution[1]);
    float t = progress(_56);
    float on = sin(3.141590118408203125 * t);
    float _265;
    if (_56.uReverse != 0u)
    {
        _265 = 1.0 - uv.x;
    }
    else
    {
        _265 = uv.x;
    }
    float x = _265;
    float lx = mix(-0.20000000298023223876953125, 1.2000000476837158203125, t);
    float k = smoothstep(lx + 0.100000001490116119384765625, lx - 0.100000001490116119384765625, x);
    float2 param = uv;
    float2 param_1 = uv;
    float4 col = mix(pictureRGBA(uFrom, uFromSmplr, param, _56), pictureRGBA(uTo, uToSmplr, param_1, _56), float4(k));
    float2 d = float2(((x - lx) * _56.iResolution[0u]) / _56.iResolution[1u], uv.y - _56.uHeight);
    float streak = exp((-abs(d.y)) * 90.0) * (0.5 + (0.5 * exp((-abs(d.x)) * 1.5)));
    float ghosts = ((exp((-abs(d.y - 0.0500000007450580596923828125)) * 160.0) + exp((-abs(d.y + 0.0500000007450580596923828125)) * 160.0)) * 0.300000011920928955078125) * exp((-abs(d.x)) * 3.0);
    float core = exp((-dot(d, d)) * 80.0);
    float bloom = exp((-length(d * float2(0.60000002384185791015625, 1.0))) * 3.0) * _56.uBloom;
    float3 light = ((float3(_56.uColor) * (streak + ghosts)) + ((float3(1.0) * core) * 1.5)) + (mix(float3(_56.uColor), float3(1.0), float3(0.60000002384185791015625)) * bloom);
    float4 _403 = col;
    float3 _421 = (_403.xyz * (1.0 + (((0.5 * bloom) * on) * _56.uStrength))) + ((light * on) * _56.uStrength);
    col.x = _421.x;
    col.y = _421.y;
    col.z = _421.z;
    fragColor = col;
}

fragment flair_transition_flare_wipe_frag_out flair_transition_flare_wipe_frag(constant FlairUniforms& _56 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_flare_wipe_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _443;
    if (_56.flair_flipY > 0.5)
    {
        _443 = _56.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _443 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _443);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _56, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

