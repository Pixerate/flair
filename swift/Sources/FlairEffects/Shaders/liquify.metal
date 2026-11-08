// flair-metal-hash: c357cf7c
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
    float uBrush;
    float uStrength;
    float uRelax;
    float uSpeed;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_liquify_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 brush(thread const float& t, constant FlairUniforms& _57)
{
    float aspect = _57.iResolution[0u] / _57.iResolution[1u];
    float2 path = float2((0.36000001430511474609375 * aspect) * sin(t * 0.89999997615814208984375), 0.300000011920928955078125 * sin((t * 1.37000000476837158203125) + 0.60000002384185791015625));
    float2 pointer = (_57.iPointer.xy - (float2(_57.iResolution[0], _57.iResolution[1]) * 0.5)) / float2(_57.iResolution[1u]);
    float2 stir = pointer + (float2(cos(t * 4.0), sin(t * 4.0)) * 0.0500000007450580596923828125);
    return mix(path, stir, float2(_57.iPointer.z));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _57)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_57.uBackdrop) * _57.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_57.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _57)
{
    float4 _201;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _201 = overBackdrop(param, _57);
    }
    else
    {
        float2 param_1 = fract(uv);
        _201 = float4(testCard(param_1), 1.0);
    }
    return _201;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _57, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 p = (fragCoord - (float2(_57.iResolution[0], _57.iResolution[1]) * 0.5)) / float2(_57.iResolution[1u]);
    float t = (_57.iTime * _57.uSpeed) * 1.39999997615814208984375;
    float dt = 0.14000000059604644775390625;
    float2 disp = float2(0.0);
    float wet = 0.0;
    for (int k = 0; k < 10; k++)
    {
        float tk = t - (float(k) * dt);
        float param = tk;
        float2 b = brush(param, _57);
        float param_1 = tk - dt;
        float2 v = b - brush(param_1, _57);
        float2 d = (p - disp) - b;
        float f = exp((-dot(d, d)) / (_57.uBrush * _57.uBrush));
        float fade = exp((((-float(k)) * dt) * _57.uRelax) / fast::max(_57.uSpeed * 1.39999997615814208984375, 0.0500000007450580596923828125));
        float2 twist = (float2(-d.y, d.x) * length(v)) * 4.0;
        disp += (((((v * 1.2999999523162841796875) + twist) * f) * fade) * _57.uStrength);
        wet += (f * fade);
    }
    float2 uv = ((p - disp) * float2(_57.iResolution[1u] / _57.iResolution[0u], 1.0)) + float2(0.5);
    float2 param_2 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_2, _57);
    float sheen = fast::clamp(dot(disp, float2(-0.60000002384185791015625, 0.800000011920928955078125)) * 12.0, -1.0, 1.0);
    float3 col = pic.xyz * (1.0 + (((0.0500000007450580596923828125 * sheen) * fast::min(wet, 1.0)) * fast::min(_57.uStrength, 1.0)));
    fragColor = float4(col, pic.w);
}

fragment flair_liquify_frag_out flair_liquify_frag(constant FlairUniforms& _57 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_liquify_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _466;
    if (_57.flair_flipY > 0.5)
    {
        _466 = _57.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _466 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _466);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _57, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

